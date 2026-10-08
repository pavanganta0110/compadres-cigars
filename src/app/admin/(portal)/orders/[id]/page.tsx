import { notFound } from "next/navigation";
import { fedexTrackUrl } from "@/lib/domain/operations";
import { formatUsd } from "@/lib/domain/money";
import { can } from "@/lib/domain/permissions";
import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";
import { refundAction, saveTrackingAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order" };

const REFUND_MESSAGES: Record<string, string> = {
  invalid_amount: "enter an amount in dollars, for example 25.00.", reason_required: "a reason is required.",
  exceeds_captured: "that is more than what remains refundable.", nothing_to_refund: "there is no captured payment to refund.",
  provider_mismatch: "the payment processor that took this payment is not the one currently configured, so it cannot refund it from here.",
  refund_failed: "the processor declined the refund. Nothing was recorded as refunded.",
};

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string; refund?: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: o } = await serviceClient().from("orders").select("*, order_items(*), age_verifications(*)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const [{ data: payments }, { data: refunds }] = await Promise.all([
    serviceClient().from("payments").select("id, provider, mode, status, amount_cents, captured_cents, refunded_cents, attempt, charge_ref, decline_code, created_at").eq("order_id", id).order("created_at", { ascending: false }),
    serviceClient().from("refunds").select("id, amount_cents, status, reason, provider_reference, created_at").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  const captured = (payments ?? []).find((p) => p.status === "captured");
  const reserved = (refunds ?? []).filter((r) => r.status !== "failed").reduce((n, r) => n + r.amount_cents, 0);
  const refundable = captured ? captured.captured_cents - reserved : 0;
  const addr = o.shipping_address as Record<string, string> | null;
  const age = (o.age_verifications as { provider: string; reference: string; verified_at: string; expires_at: string }[])[0];
  return (
    <>
      <h1>Order #{o.number}</h1>
      <p><span className="adm-pill">{o.status}</span> · {o.email}</p>
      <h2>Items</h2>
      <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>
        {(o.order_items as { id: string; sku: string; name: string; quantity: number; unit_price_cents: number }[]).map((i) => <tr key={i.id}><td>{i.sku}</td><td>{i.name}</td><td>{i.quantity}</td><td>{formatUsd(i.unit_price_cents)}</td></tr>)}
      </tbody></table></div>
      <p>Subtotal {formatUsd(o.subtotal_cents)} · Shipping {formatUsd(o.shipping_cents)} · Estimated tax {formatUsd(o.tax_cents)} · <strong>Total {formatUsd(o.total_cents)}</strong></p>
      <h2>Ship to (adult signature required)</h2>
      {addr && <p>{addr.recipient}<br />{addr.line1} {addr.line2}<br />{addr.city}, {addr.state} {addr.postal_code}<br />Service: {o.shipping_service}</p>}
      <h2>Compliance</h2>
      {age && <p>Age verification: {age.provider} · ref {age.reference} · verified {new Date(age.verified_at).toLocaleString()} · expires {new Date(age.expires_at).toLocaleString()}</p>}
      <details><summary>Immutable compliance snapshot (v{o.compliance_snapshot_version})</summary><pre style={{ overflow: "auto" }}>{JSON.stringify(o.compliance_snapshot, null, 2)}</pre></details>
      <h2>Payment</h2>
      {(payments ?? []).length === 0 ? <p>No payment attempts. The order is {o.status}.</p> : (
        <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>When</th><th>Processor</th><th>Status</th><th>Amount</th><th>Refunded</th><th>Note</th></tr></thead><tbody>
          {(payments ?? []).map((p) => <tr key={p.id}><td>{new Date(p.created_at).toLocaleString()}</td><td>{p.provider} ({p.mode})</td><td>{p.status}</td><td>{formatUsd(p.amount_cents)}</td><td>{formatUsd(p.refunded_cents)}</td><td>{p.decline_code ?? ""}</td></tr>)}
        </tbody></table></div>
      )}
      {sp.refund === "ok" && <p className="adm-note" role="status">Refund issued.</p>}
      {sp.refund && sp.refund !== "ok" && <p className="adm-alert" role="alert">Refund not issued: {REFUND_MESSAGES[sp.refund] ?? "it could not be completed. Nothing was recorded as refunded; check the audit log."}</p>}
      {(refunds ?? []).length > 0 && (
        <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>When</th><th>Refund</th><th>Status</th><th>Reason</th></tr></thead><tbody>
          {(refunds ?? []).map((r) => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{formatUsd(r.amount_cents)}</td><td>{r.status}</td><td>{r.reason}</td></tr>)}
        </tbody></table></div>
      )}
      {captured && can(staff.role, "refund") && refundable > 0 && (
        <form action={refundAction} className="adm-inline">
          <input type="hidden" name="orderId" value={o.id} />
          <label>Refund amount (USD, up to {formatUsd(refundable)})<input name="amount" inputMode="decimal" required /></label>
          <label>Reason<input name="reason" required minLength={3} maxLength={200} /></label>
          <button className="adm-btn" type="submit">Issue refund</button>
        </form>
      )}
      <h2>Tracking</h2>
      {sp.saved && <p className="adm-note" role="status">Tracking number saved.</p>}
      {sp.error === "tracking" && <p className="adm-alert" role="alert">Tracking numbers are 6 to 34 letters or digits.</p>}
      {sp.error === "status" && <p className="adm-alert" role="alert">Mark the order as packed before recording a tracking number.</p>}
      {o.tracking_number && <p>FedEx: <a href={fedexTrackUrl(o.tracking_number)} rel="noreferrer noopener" target="_blank">{o.tracking_number}</a> · status {o.carrier_status_text ?? o.carrier_status_code ?? "not checked yet"}</p>}
      {can(staff.role, "fulfill") && (
        <form action={saveTrackingAction} className="adm-inline">
          <input type="hidden" name="orderId" value={o.id} />
          <label>Tracking number (create the label in FedEx first)<input name="tracking" defaultValue={o.tracking_number ?? ""} required /></label>
          <button className="adm-btn" type="submit">Save tracking</button>
        </form>
      )}
    </>
  );
}
