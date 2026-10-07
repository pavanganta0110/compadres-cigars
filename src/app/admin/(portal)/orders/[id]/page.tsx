import { notFound } from "next/navigation";
import { fedexTrackUrl } from "@/lib/domain/operations";
import { formatUsd } from "@/lib/domain/money";
import { can } from "@/lib/domain/permissions";
import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";
import { saveTrackingAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order" };

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: o } = await serviceClient().from("orders").select("*, order_items(*), age_verifications(*)").eq("id", id).maybeSingle();
  if (!o) notFound();
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
