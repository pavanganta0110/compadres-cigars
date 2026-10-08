import "server-only";
import type { PaymentEvent } from "@/lib/payments/types";
import { serviceClient } from "./db";
import { auditPayment } from "./payment-service";

/** Applies one VERIFIED, not-yet-seen event. Only facts that already happened at the processor are recorded. */
async function apply(provider: string, e: PaymentEvent): Promise<"recorded" | "noted"> {
  const db = serviceClient();
  if (e.type === "charge.refunded" && e.chargeRef && e.refundRef && e.amountCents && e.amountCents > 0) {
    const { data: known } = await db.from("refunds").select("id").eq("provider_reference", e.refundRef).maybeSingle();
    if (known) { await auditPayment("webhook.refund_already_recorded", null, { provider, eventId: e.id, refundRef: e.refundRef }); return "noted"; }
    const { data: pay } = await db.from("payments").select("order_id").eq("charge_ref", e.chargeRef).eq("status", "captured").maybeSingle();
    if (!pay) { await auditPayment("webhook.unmatched", null, { provider, eventId: e.id, type: e.type }); return "noted"; }
    // A refund made directly in the processor's dashboard: record it so reports and order status stay true.
    const begun = await db.rpc("begin_refund", { p_order: pay.order_id, p_amount: e.amountCents, p_reason: "Refunded at the processor", p_actor: null });
    const b = begun.data as { ok: boolean; code?: string; refund_id?: string } | null;
    if (!b?.ok) { await auditPayment("webhook.refund_mismatch", pay.order_id as string, { provider, eventId: e.id, code: b?.code, amountCents: e.amountCents }); return "noted"; }
    const fin = await db.rpc("finish_refund", { p_refund: b.refund_id, p_ok: true, p_provider_ref: e.refundRef, p_failure: null });
    if (fin.error) throw new Error("finish_refund failed");
    await auditPayment("webhook.refund_recorded", pay.order_id as string, { provider, eventId: e.id, refundRef: e.refundRef, amountCents: e.amountCents });
    return "recorded";
  }
  await auditPayment("webhook.received", null, { provider, eventId: e.id, type: e.type });
  return "noted";
}

export type WebhookOutcome = { processed: number; duplicates: number };

/** Claims each event id first (idempotency). If applying fails, the claim is released so the processor's retry is not lost. */
export async function processEvents(provider: string, events: PaymentEvent[]): Promise<WebhookOutcome> {
  const db = serviceClient();
  const out: WebhookOutcome = { processed: 0, duplicates: 0 };
  for (const e of events) {
    const claim = await db.rpc("claim_payment_event", { p_provider: provider, p_event_id: e.id, p_type: e.type });
    if (claim.error) throw new Error("claim failed");
    if (claim.data !== true) { out.duplicates++; continue; }
    try { await apply(provider, e); out.processed++; }
    catch (err) { await db.from("payment_events").delete().eq("provider", provider).eq("event_id", e.id); throw err; }
  }
  return out;
}
