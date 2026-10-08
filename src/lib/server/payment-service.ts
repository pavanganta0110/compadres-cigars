import "server-only";
import { evaluateCheckout, type CartLine, type CheckoutFailure } from "@/lib/domain/checkout";
import { redact } from "@/lib/domain/audit";
import type { AgeVerificationProvider, VerificationResult } from "@/lib/domain/age";
import { isAcceptableToken } from "@/lib/payments/token";
import { loadRestrictions, loadTaxRates } from "./checkout-service";
import { serviceClient } from "./db";
import { paymentSetup, shippingProvider } from "./providers";

export type PayResult = { ok: true } | { ok: false; code: string; step?: string };

export async function auditPayment(action: string, orderId: string | null, detail: Record<string, unknown>, actor = "system") {
  await serviceClient().from("audit_log").insert({ actor, action, entity: orderId ? "orders" : "payments", entity_id: orderId, detail: redact(detail) as object }).then(() => undefined, () => undefined);
}

/** Replays the age verification recorded when the order was created (it must still be unexpired at charge time). */
class StoredAgeProvider implements AgeVerificationProvider {
  readonly name = "stored";
  constructor(private rec: { provider: string; reference: string | null; status: string; verified_at: string | null; expires_at: string | null } | undefined) {}
  async verify(): Promise<VerificationResult> {
    const r = this.rec;
    if (!r || r.status !== "verified") return { provider: this.rec?.provider ?? "none", reference: r?.reference ?? "", status: "failed", verifiedAt: null, expiresAt: null };
    return { provider: r.provider, reference: r.reference ?? "", status: "passed", verifiedAt: r.verified_at ? new Date(r.verified_at) : null, expiresAt: r.expires_at ? new Date(r.expires_at) : null };
  }
}

type OrderForPayment = {
  id: string; status: string; subtotal_cents: number; shipping_cents: number; tax_cents: number; total_cents: number; shipping_service: string | null;
  shipping_address: { state?: string; postal_code?: string } | null;
  order_items: { product_id: string | null; sku: string; name: string; quantity: number; unit_price_cents: number }[];
  age_verifications: { provider: string; reference: string | null; status: string; verified_at: string | null; expires_at: string | null }[];
};

/**
 * Re-runs the FULL compliance pipeline against the stored order, right before any money moves: current restrictions,
 * the recorded (unexpired) age verification, live Adult Signature eligibility, tax, and that the totals still match.
 * Stock was already reserved when the order was created, so it is added back for this check.
 */
async function recheckCompliance(o: OrderForPayment): Promise<PayResult> {
  const ids = o.order_items.map((i) => i.product_id).filter((x): x is string => !!x);
  const { data: prods } = await serviceClient().from("products").select("id, stock, weight_oz").in("id", ids);
  const byId = new Map((prods ?? []).map((p) => [p.id as string, p]));
  const lines: CartLine[] = [];
  for (const i of o.order_items) {
    const p = i.product_id ? byId.get(i.product_id) : undefined;
    if (!p) return { ok: false, code: "stock_unavailable", step: "cart_stock" };
    lines.push({ productId: i.product_id!, sku: i.sku, name: i.name, quantity: i.quantity, unitPriceCents: i.unit_price_cents, stock: Number(p.stock) + i.quantity, weightOz: p.weight_oz === null ? null : Number(p.weight_oz) });
  }
  const r = await evaluateCheckout({
    lines, destination: { country: "US", state: o.shipping_address?.state ?? "", postalCode: o.shipping_address?.postal_code ?? "" },
    restrictions: await loadRestrictions(), taxRates: await loadTaxRates(), attested: true, chosenService: o.shipping_service ?? "",
    ageProvider: new StoredAgeProvider(o.age_verifications[0]), shippingProvider: shippingProvider().provider, now: new Date(),
  });
  if (!r.ok) return { ok: false, code: (r as CheckoutFailure).code, step: (r as CheckoutFailure).step };
  if (r.totalCents !== o.total_cents || r.tax.tax_cents !== o.tax_cents || r.shipping.cents !== o.shipping_cents || r.subtotalCents !== o.subtotal_cents) {
    return { ok: false, code: "price_changed", step: "recheck" };
  }
  return { ok: true };
}

/**
 * Charges a pending order. Order of events (the first failure stops everything and the order stays pending):
 * token shape -> load order -> compliance re-check -> claim the order in SQL (one live payment per order, so a double
 * submit charges once) -> authorize -> capture (void the authorization if capture fails) -> pending -> processing.
 * Card data never gets here: only the processor's opaque token.
 */
export async function payOrder(orderId: string, token: unknown): Promise<PayResult> {
  const db = serviceClient();
  const setup = await paymentSetup();
  if (!setup.tokenizer) { await auditPayment("payment.unavailable", orderId, { provider: setup.name, mode: setup.mode }); return { ok: false, code: "payment_unavailable" }; }
  if (!isAcceptableToken(token)) { await auditPayment("payment.rejected_token", orderId, {}); return { ok: false, code: "invalid_payment_token" }; }

  const { data: order } = await db.from("orders")
    .select("id, status, subtotal_cents, shipping_cents, tax_cents, total_cents, shipping_service, shipping_address, order_items(product_id, sku, name, quantity, unit_price_cents), age_verifications(provider, reference, status, verified_at, expires_at)")
    .eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, code: "order_not_found" };
  const o = order as unknown as OrderForPayment;
  if (o.status !== "pending") return { ok: false, code: "already_paid" };

  const check = await recheckCompliance(o);
  if (!check.ok) {
    await auditPayment("payment.blocked", orderId, { step: check.step, code: check.code });
    return check;
  }

  const begun = await db.rpc("begin_payment", { p_order: orderId, p_provider: setup.name, p_mode: setup.paymentMode });
  const b = begun.data as { ok: boolean; code?: string; payment_id?: string; attempt?: number } | null;
  if (begun.error || !b) { await auditPayment("payment.error", orderId, { stage: "begin" }); return { ok: false, code: "payment_error" }; }
  if (!b.ok) return { ok: false, code: b.code === "payment_in_progress" || b.code === "already_paid" ? b.code : "payment_error" };
  const paymentId = b.payment_id!;
  const setState = (patch: Record<string, unknown>) => db.from("payments").update(patch).eq("id", paymentId).then((r) => r, (e) => ({ error: e }));
  const meta = { paymentId, attempt: b.attempt, provider: setup.name, mode: setup.paymentMode, amountCents: o.total_cents };

  const auth = await setup.provider.authorize({ amountCents: o.total_cents, token, idempotencyKey: paymentId, description: "Compadres Cigars order" });
  if (!auth.ok) {
    await setState({ status: auth.code === "declined" ? "declined" : "failed", decline_code: (auth.providerCode ?? auth.code).slice(0, 80) });
    await auditPayment(auth.code === "declined" ? "payment.declined" : "payment.authorize_failed", orderId, { ...meta, code: auth.code, providerCode: auth.providerCode });
    return { ok: false, code: auth.code === "declined" ? "payment_declined" : auth.code === "invalid_token" ? "invalid_payment_token" : auth.code === "unavailable" ? "payment_unavailable" : "payment_error" };
  }
  await setState({ status: "authorized", authorization_ref: auth.reference });
  await auditPayment("payment.authorized", orderId, { ...meta, ref: auth.reference });

  const cap = await setup.provider.capture({ reference: auth.reference, amountCents: o.total_cents, idempotencyKey: `c-${paymentId}` });
  if (!cap.ok) {
    const v = await setup.provider.void({ reference: auth.reference, amountCents: o.total_cents, idempotencyKey: `v-${paymentId}` });
    await auditPayment("payment.capture_failed", orderId, { ...meta, ref: auth.reference, code: cap.code, providerCode: cap.providerCode });
    await auditPayment(v.ok ? "payment.voided" : "payment.void_failed", orderId, { ...meta, ref: auth.reference, code: v.ok ? undefined : v.code });
    // If the void failed the row stays 'authorized' and keeps blocking new charges: staff must resolve it (shown on the Payments page).
    if (v.ok) await setState({ status: "voided" });
    return { ok: false, code: "payment_error" };
  }

  const done = await db.rpc("complete_payment", { p_payment: paymentId, p_charge_ref: cap.reference });
  if (done.error || !(done.data as { ok?: boolean } | null)?.ok) {
    // Money was captured but the order did not move. The payment row stays 'authorized' so nobody can be charged twice.
    await auditPayment("payment.reconcile_needed", orderId, { ...meta, ref: cap.reference });
    return { ok: false, code: "payment_error" };
  }
  await auditPayment("payment.capture_recorded", orderId, { ...meta, ref: cap.reference });
  return { ok: true };
}
