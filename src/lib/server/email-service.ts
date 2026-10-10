import "server-only";
import { after } from "next/server";
import { stockState } from "@/lib/domain/inventory";
import { parseList, recipientAllowed, selectEmail, type EmailMode } from "@/lib/email/gate";
import { MockEmailProvider } from "@/lib/email/mock";
import { fromAddressOk, ResendEmailProvider } from "@/lib/email/resend";
import { renderEmail, type AdminOrderPayload, type OrderPayload, type ShippedPayload } from "@/lib/email/templates";
import { UnavailableEmailProvider, type EmailKind, type EmailProvider } from "@/lib/email/types";
import { serviceClient } from "./db";

export type EmailSetup = {
  provider: EmailProvider; mode: EmailMode; name: string; detail: string; from: string;
  /** Staff who receive new-order, stock and review alerts. */
  adminEmails: string[]; allowlist: string[]; siteUrl: string | undefined; productionReady: boolean;
};

export function emailSetup(env: Record<string, string | undefined> = process.env): EmailSetup {
  const from = (env.COMPADRES_EMAIL_FROM ?? "").trim();
  const key = (env.COMPADRES_EMAIL_API_KEY ?? "").trim();
  const adminEmails = parseList(env.COMPADRES_ADMIN_ALERT_EMAILS);
  const allowlist = [...new Set([...adminEmails, ...parseList(env.COMPADRES_EMAIL_TEST_ALLOWLIST)])];
  const siteUrl = (env.COMPADRES_SITE_URL ?? "").trim().replace(/\/+$/, "") || undefined;
  const sel = selectEmail({ appEnv: env.APP_ENV, provider: env.COMPADRES_EMAIL_PROVIDER, approved: env.COMPADRES_EMAIL_PRODUCTION_APPROVED, resendConfigured: key.length >= 8 && fromAddressOk(from) });
  const common = { from, adminEmails, allowlist, siteUrl };
  if (sel.kind === "unavailable") return { ...common, provider: new UnavailableEmailProvider(), mode: "disabled", name: "none", detail: `Unavailable: ${sel.reason} Emails queue but are not sent.`, productionReady: false };
  if (sel.kind === "mock") return { ...common, provider: new MockEmailProvider(), mode: "mock", name: "mock", detail: "Mock email (local/staging only). Nothing is delivered.", productionReady: false };
  return {
    ...common, provider: new ResendEmailProvider(key, from), mode: sel.mode, name: "resend", productionReady: sel.mode === "live",
    detail: sel.mode === "live" ? "Resend, LIVE gates satisfied: customers receive real email." : "Resend, sandbox: only staff and allowlisted addresses receive real email; customers' emails are skipped.",
  };
}

/** Queue one email for a business event. Idempotent per dedupe key, and never throws (email must never break an order). */
export async function enqueue(kind: EmailKind, dedupeKey: string, to: string, payload: unknown): Promise<void> {
  try {
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;
    const { subject } = renderEmail(kind, payload);
    await serviceClient().rpc("enqueue_email", { p_kind: kind, p_key: dedupeKey, p_to: to, p_subject: subject, p_payload: payload as object });
  } catch { /* swallowed on purpose; the audit trail of business events does not depend on email */ }
}

/** Send what is due, after the response, without ever blocking or failing the caller. */
export function sendSoon(): void {
  try { after(() => processOutbox().then(() => undefined, () => undefined)); } catch { /* not in a request scope */ }
}

export type OutboxResult = { sent: number; skipped: number; retry: number; dead: number };

export async function processOutbox(limit = 20): Promise<OutboxResult> {
  const db = serviceClient();
  const setup = emailSetup();
  const out: OutboxResult = { sent: 0, skipped: 0, retry: 0, dead: 0 };
  if (setup.mode === "disabled") return out;   // nothing configured: leave everything queued (attempts are not burned)
  const { data } = await db.rpc("claim_emails", { p_limit: limit });
  for (const row of (data ?? []) as { id: string; kind: EmailKind; dedupe_key: string; to_email: string; payload: unknown }[]) {
    const finish = (outcome: string, id?: string, err?: string) => db.rpc("finish_email", { p_id: row.id, p_outcome: outcome, p_provider: setup.name, p_provider_id: id ?? null, p_error: err ?? null });
    if (!recipientAllowed(setup.mode, row.to_email, setup.allowlist)) { await finish("skipped", undefined, "sandbox_recipient_not_allowed"); out.skipped++; continue; }
    const r = renderEmail(row.kind, row.payload);
    const res = await setup.provider.send({ to: row.to_email, subject: r.subject, html: r.html, text: r.text, idempotencyKey: row.dedupe_key });
    if (res.ok) { await finish("sent", res.id); out.sent++; }
    else if (res.retryable) { await finish("retry", undefined, res.code); out.retry++; }
    else { await finish("dead", undefined, res.code); out.dead++; }
  }
  return out;
}

// ------------------------------------------------------------------ event helpers (each is best-effort)

type OrderRow = {
  id: string; number: number; email: string; subtotal_cents: number; shipping_cents: number; tax_cents: number; total_cents: number;
  shipping_address: OrderPayload["address"] | null; shipping_service: string | null;
  order_items: { name: string; quantity: number; unit_price_cents: number; product_id: string | null }[]; customers: { full_name: string | null } | null;
};
async function loadOrder(orderId: string): Promise<OrderRow | null> {
  const { data } = await serviceClient().from("orders")
    .select("id, number, email, subtotal_cents, shipping_cents, tax_cents, total_cents, shipping_address, shipping_service, order_items(name, quantity, unit_price_cents, product_id), customers(full_name)")
    .eq("id", orderId).maybeSingle();
  return (data as unknown as OrderRow) ?? null;
}
const orderPayload = (o: OrderRow, siteUrl?: string): OrderPayload => ({
  orderId: o.id, number: o.number, name: o.customers?.full_name ?? undefined,
  items: o.order_items.map(({ name, quantity, unit_price_cents }) => ({ name, quantity, unit_price_cents })),
  subtotal_cents: o.subtotal_cents, shipping_cents: o.shipping_cents, tax_cents: o.tax_cents, total_cents: o.total_cents, address: o.shipping_address ?? {}, siteUrl,
});

/** Payment captured: customer confirmation, staff new-order alert, and low-stock alerts for what was just sold. */
export async function notifyOrderPaid(orderId: string): Promise<void> {
  try {
    const setup = emailSetup();
    const o = await loadOrder(orderId);
    if (!o) return;
    await enqueue("order_confirmation", `order_confirmation:${o.id}`, o.email, orderPayload(o, setup.siteUrl));
    const admin: AdminOrderPayload = { orderId: o.id, number: o.number, total_cents: o.total_cents, state: o.shipping_address?.state, items: o.order_items.map(({ name, quantity, unit_price_cents }) => ({ name, quantity, unit_price_cents })), siteUrl: setup.siteUrl };
    for (const to of setup.adminEmails) await enqueue("admin_new_order", `admin_new_order:${o.id}:${to}`, to, admin);
    const ids = o.order_items.map((i) => i.product_id).filter((x): x is string => !!x);
    if (ids.length) {
      const { data: prods } = await serviceClient().from("products").select("name, sku, stock, low_stock_threshold, active").in("id", ids);
      const day = new Date().toISOString().slice(0, 10);
      for (const p of prods ?? []) {
        const st = stockState(p.stock as number, p.low_stock_threshold as number);
        if (!p.active || st === "ok") continue;
        for (const to of setup.adminEmails) await enqueue("admin_low_stock", `low_stock:${p.sku}:${st}:${day}:${to}`, to, { name: p.name, sku: p.sku, stock: p.stock, threshold: p.low_stock_threshold, state: st, siteUrl: setup.siteUrl });
      }
    }
  } catch { /* best effort */ }
  sendSoon();
}

export async function notifyShipped(orderId: string, tracking: string): Promise<void> {
  try {
    const setup = emailSetup();
    const o = await loadOrder(orderId);
    if (!o) return;
    const payload: ShippedPayload = { ...orderPayload(o, setup.siteUrl), tracking, service: o.shipping_service ?? undefined };
    await enqueue("order_shipped", `order_shipped:${o.id}:${tracking}`, o.email, payload);
  } catch { /* best effort */ }
  sendSoon();
}

export async function notifyRefund(orderId: string, refundId: string, amountCents: number, fully: boolean): Promise<void> {
  try {
    const o = await loadOrder(orderId);
    if (!o) return;
    await enqueue("refund_issued", `refund_issued:${refundId}`, o.email, { orderId: o.id, number: o.number, name: o.customers?.full_name ?? undefined, amount_cents: amountCents, fully, siteUrl: emailSetup().siteUrl });
  } catch { /* best effort */ }
  sendSoon();
}

/** A person must look at the processor (captured payment not recorded, refund not recorded...). */
export async function notifyNeedsReview(what: string, orderId: string | null, dedupe: string): Promise<void> {
  try {
    const setup = emailSetup();
    const o = orderId ? await loadOrder(orderId) : null;
    for (const to of setup.adminEmails) await enqueue("admin_needs_review", `needs_review:${dedupe}:${to}`, to, { what, number: o?.number, orderId: o?.id, siteUrl: setup.siteUrl });
  } catch { /* best effort */ }
  sendSoon();
}
