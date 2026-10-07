import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { evaluateCheckout, type CheckoutFailure } from "@/lib/domain/checkout";
import { cartFingerprint } from "@/lib/domain/fingerprint";
import { buildComplianceSnapshot, COMPLIANCE_SNAPSHOT_VERSION } from "@/lib/domain/snapshot";
import { redact } from "@/lib/domain/audit";
import type { RestrictionStatus } from "@/lib/domain/restrictions";
import { readCart, resolveLines } from "./cart-store";
import { serviceClient } from "./db";
import { ageProvider, shippingProvider } from "./providers";

export const CHECKOUT_SESSION_COOKIE = "cc_chk";

export const CheckoutForm = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  fullName: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  postalCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/),
  shippingService: z.string().trim().min(1).max(60),
});

export async function loadRestrictions(): Promise<Map<string, RestrictionStatus>> {
  const { data, error } = await serviceClient().from("restriction_rules").select("state,status");
  if (error) throw error;
  return new Map((data ?? []).map((r) => [String(r.state).trim(), r.status as RestrictionStatus]));
}

async function audit(action: string, detail: Record<string, unknown>) {
  await serviceClient().from("audit_log").insert({ actor: "system", action, entity: "checkout", detail: redact(detail) as object });
}

export type PlaceResult = { ok: true; orderId: string } | { ok: false; code: string; step?: string };

/**
 * Server-authoritative order placement. Ignores every client-supplied "passed"/price/tax value:
 * only cart quantities, destination, service choice and the attestation checkbox are read, then
 * the full check order runs, then Postgres re-checks stock/geo/age/tax inside the order transaction.
 */
export async function placeOrder(input: z.infer<typeof CheckoutForm>, attested: boolean): Promise<PlaceResult> {
  const now = new Date();
  const lines = await resolveLines(await readCart());
  const destination = { country: "US", state: input.state, postalCode: input.postalCode };
  const result = await evaluateCheckout({
    lines, destination, restrictions: await loadRestrictions(), attested, chosenService: input.shippingService,
    ageProvider: ageProvider().provider, shippingProvider: shippingProvider().provider, now,
  });
  if (!result.ok) {
    await audit("checkout.blocked", { step: (result as CheckoutFailure).step, code: (result as CheckoutFailure).code, state: input.state });
    return { ok: false, code: (result as CheckoutFailure).code, step: (result as CheckoutFailure).step };
  }

  const jar = await cookies();
  const sessionId = jar.get(CHECKOUT_SESSION_COOKIE)?.value ?? crypto.randomUUID();
  const leaseKey = await cartFingerprint({
    items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    country: "US", state: input.state, postalCode: input.postalCode, shippingService: input.shippingService, sessionId,
  });
  const snapshot = buildComplianceSnapshot({ now, country: "US", state: input.state, postalCode: input.postalCode, age: result.age, service: result.shipping.service, tax: result.tax });

  const { data, error } = await serviceClient().rpc("create_checkout_order", {
    p: {
      email: input.email, full_name: input.fullName, lease_key: leaseKey,
      items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
      address: { recipient: input.fullName, line1: input.line1, line2: input.line2, city: input.city, state: input.state, postal_code: input.postalCode, country: "US" },
      shipping: { service: result.shipping.service, cents: result.shipping.cents },
      expected_subtotal_cents: result.subtotalCents, expected_tax_cents: result.tax.tax_cents,
      tax_snapshot: result.tax, compliance_snapshot: snapshot, compliance_snapshot_version: COMPLIANCE_SNAPSHOT_VERSION,
      age: { provider: result.age.provider, reference: result.age.reference, status: result.age.status, verified_at: result.age.verifiedAt?.toISOString(), expires_at: result.age.expiresAt?.toISOString() },
    },
  });
  if (error || !data) { await audit("checkout.error", { message: error?.message }); return { ok: false, code: "unexpected" }; }
  const r = data as { ok: boolean; code?: string; order_id?: string };
  if (!r.ok) {
    await audit("checkout.blocked", { step: "order_creation", code: r.code, state: input.state });
    return { ok: false, code: r.code ?? "unexpected", step: "order_creation" };
  }
  return { ok: true, orderId: r.order_id! };
}
