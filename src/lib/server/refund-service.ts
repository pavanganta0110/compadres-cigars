import "server-only";
import { notifyNeedsReview, notifyRefund } from "./email-service";
import { auditPayment } from "./payment-service";
import { serviceClient } from "./db";
import { paymentSetup } from "./providers";

export type RefundResult = { ok: true; fullyRefunded: boolean } | { ok: false; code: string };

/**
 * Staff refund. The processor does the refunding; we only record it. The amount is reserved in SQL first
 * (so two clicks cannot exceed the captured total), then the processor is called, then the reservation is settled.
 * Callers MUST have passed requireStaff("refund").
 */
export async function refundOrder(opts: { orderId: string; amountCents: number; reason: string; staffId: string }): Promise<RefundResult> {
  const db = serviceClient();
  const { data: pay } = await db.from("payments").select("id, provider, mode, charge_ref").eq("order_id", opts.orderId).eq("status", "captured").maybeSingle();
  if (!pay || !pay.charge_ref) return { ok: false, code: "nothing_to_refund" };

  // Refund through the processor (and mode) that took the money. A sandbox/mock setup can never touch a live charge.
  const setup = await paymentSetup();
  if (setup.provider.name !== pay.provider || setup.paymentMode !== pay.mode) {
    await auditPayment("refund.blocked", opts.orderId, { code: "provider_mismatch", chargedWith: pay.provider, chargedMode: pay.mode }, opts.staffId);
    return { ok: false, code: "provider_mismatch" };
  }

  const begun = await db.rpc("begin_refund", { p_order: opts.orderId, p_amount: opts.amountCents, p_reason: opts.reason, p_actor: opts.staffId });
  const b = begun.data as { ok: boolean; code?: string; refund_id?: string } | null;
  if (begun.error || !b) return { ok: false, code: "refund_error" };
  if (!b.ok) { await auditPayment("refund.rejected", opts.orderId, { code: b.code, amountCents: opts.amountCents }, opts.staffId); return { ok: false, code: b.code ?? "refund_error" }; }
  const refundId = b.refund_id!;
  await auditPayment("refund.requested", opts.orderId, { refundId, amountCents: opts.amountCents, reason: opts.reason }, opts.staffId);

  const r = await setup.provider.refund({ reference: pay.charge_ref as string, amountCents: opts.amountCents, idempotencyKey: `r-${refundId}`, reason: opts.reason });
  const fin = await db.rpc("finish_refund", { p_refund: refundId, p_ok: r.ok, p_provider_ref: r.ok ? r.reference : null, p_failure: r.ok ? null : r.providerCode ?? r.code });
  const f = fin.data as { ok?: boolean; fully_refunded?: boolean } | null;
  if (!r.ok) {
    await auditPayment("refund.failed", opts.orderId, { refundId, code: r.code, providerCode: r.providerCode }, opts.staffId);
    return { ok: false, code: "refund_failed" };
  }
  if (fin.error || !f?.ok) {
    // The processor refunded but we could not record it. The row stays 'pending' (the amount stays reserved) for staff to reconcile.
    await auditPayment("refund.reconcile_needed", opts.orderId, { refundId, ref: r.reference }, opts.staffId);
    await notifyNeedsReview("A refund was issued at the processor but could not be recorded", opts.orderId, `refund:${refundId}`);
    return { ok: false, code: "refund_error" };
  }
  await auditPayment("refund.completed", opts.orderId, { refundId, amountCents: opts.amountCents, ref: r.reference, fullyRefunded: !!f.fully_refunded }, opts.staffId);
  await notifyRefund(opts.orderId, refundId, opts.amountCents, !!f.fully_refunded);
  return { ok: true, fullyRefunded: !!f.fully_refunded };
}
