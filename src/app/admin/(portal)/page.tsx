import Link from "next/link";
import { formatUsd } from "@/lib/domain/money";
import { formatWaiting, packQueue, summarizeOps } from "@/lib/domain/operations";
import { can } from "@/lib/domain/permissions";
import { loadOrders } from "@/lib/server/admin-data";
import { serviceClient } from "@/lib/server/db";
import { shippingProvider } from "@/lib/server/providers";
import { requireStaff } from "@/lib/server/staff";
import { markPackedAction } from "./orders/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

function healthRows() {
  const ship = shippingProvider();
  const detail = ship.name === "fedex" ? "FedEx REST (adult signature rates, tracking)." : ship.name === "mock" ? "Mock rates (not FedEx)." : `Unavailable: ${ship.name}. Checkout cannot quote shipping.`;
  return [
    { name: "Age verification", mode: "sandbox", detail: "Self-attestation (checkbox). Not identity verification; carries regulatory and underwriting risk.", prod: false },
    { name: "Shipping", mode: ship.mode, detail, prod: ship.mode === "live" },
    { name: "Payments", mode: "disabled", detail: "Not connected yet.", prod: false },
  ];
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const staff = await requireStaff();
  const { denied } = await searchParams;
  const now = new Date();
  const db = serviceClient();
  const [orders, blocked, refunds] = await Promise.all([
    loadOrders({ sinceDays: 120 }),
    db.from("audit_log").select("id, at, detail").eq("action", "checkout.blocked").in("detail->>code", ["age_not_verified", "shipping_ineligible"]).gte("at", new Date(now.getTime() - 7 * 86400_000).toISOString()).order("at", { ascending: false }).limit(10),
    db.from("refunds").select("id, amount_cents, created_at, order_id").order("created_at", { ascending: false }).limit(5),
  ]);
  const s = summarizeOps(orders, now);
  const queue = packQueue(orders, now);
  const shipped = orders.filter((o) => o.tracking_number).slice(0, 8);
  const canFulfill = can(staff.role, "fulfill");

  return (
    <>
      <h1>Dashboard</h1>
      {denied && <p className="adm-alert" role="alert">Your role does not allow that.</p>}

      <h2>Integration health</h2>
      <ul className="adm-health">
        {healthRows().map((h) => (
          <li key={h.name}>
            <span><strong>{h.name}</strong><br /><small>{h.detail}</small></span>
            <span><span className={`adm-pill ${h.mode === "disabled" ? "warn" : ""}`}>{h.mode}</span>{" "}<span className={`adm-pill ${h.prod ? "" : "warn"}`}>{h.prod ? "production-ready" : "not production-ready"}</span></span>
          </li>
        ))}
      </ul>

      <h2>Orders and fulfillment</h2>
      <p className="adm-note">Paid orders received: <strong>{s.received.today}</strong> today · <strong>{s.received.days7}</strong> in 7 days · <strong>{s.received.days30}</strong> in 30 days</p>
      <div className="adm-cards">
        <div className="adm-card"><strong>{s.notPacked}</strong>Not packed</div>
        <div className="adm-card"><strong>{s.packedNeedsLabel}</strong>Packed (needs a label)</div>
        <div className="adm-card"><strong>{s.shipped}</strong>Shipped (in transit)</div>
        <div className="adm-card"><strong>{s.delivered30}</strong>Delivered (30 days)</div>
        {s.unpackedOver24h > 0 && <div className="adm-card alert" role="alert"><strong>{s.unpackedOver24h}</strong>Unpacked over 24 hours</div>}
      </div>

      <h2>Orders to pack and ship</h2>
      {queue.length === 0 ? <p>Nothing waiting to be packed.</p> : (
        <form action={markPackedAction}>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr>{canFulfill && <th><span className="sr-only">Select</span></th>}<th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Waiting</th></tr></thead>
            <tbody>
              {queue.map((o) => (
                <tr key={o.id} className={o.late ? "late" : ""}>
                  {canFulfill && <td><input type="checkbox" name="orderId" value={o.id} aria-label={`Select order ${o.number}`} /></td>}
                  <td><Link href={`/admin/orders/${o.id}`}>#{o.number}</Link></td>
                  <td>{orders.find((x) => x.id === o.id)?.email}</td>
                  <td>{orders.find((x) => x.id === o.id)?.item_count}</td>
                  <td>{formatUsd(orders.find((x) => x.id === o.id)?.total_cents ?? 0)}</td>
                  <td>{o.status}</td>
                  <td>{formatWaiting(o.waitingMs)}{o.late && " (late)"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {canFulfill && <p><button className="adm-btn" type="submit">Mark selected as packed</button></p>}
        </form>
      )}

      <h2>Orders needing attention</h2>
      {(blocked.data ?? []).length === 0 ? <p>No failed age checks or blocked shipping in the last 7 days.</p> : (
        <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>When</th><th>Problem</th><th>State</th></tr></thead><tbody>
          {(blocked.data ?? []).map((b) => { const d = b.detail as { code?: string; state?: string }; return (
            <tr key={b.id}><td>{new Date(b.at).toLocaleString()}</td><td>{d.code === "age_not_verified" ? "Age check not completed" : "Shipping service not eligible"}</td><td>{d.state}</td></tr>
          ); })}
        </tbody></table></div>
      )}

      <h2>Recent shipments</h2>
      {shipped.length === 0 ? <p>No tracking numbers recorded yet.</p> : (
        <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Order</th><th>Tracking</th><th>Carrier status</th></tr></thead><tbody>
          {shipped.map((o) => <tr key={o.id}><td><Link href={`/admin/orders/${o.id}`}>#{o.number}</Link></td><td>{o.tracking_number}</td><td>{o.carrier_status_code ?? "Not checked yet"}</td></tr>)}
        </tbody></table></div>
      )}

      <h2>Recent refunds</h2>
      {(refunds.data ?? []).length === 0 ? <p>No refunds.</p> : (
        <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>When</th><th>Amount</th></tr></thead><tbody>
          {(refunds.data ?? []).map((r) => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{formatUsd(r.amount_cents)}</td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}
