import Link from "next/link";
import { formatUsd } from "@/lib/domain/money";
import { can } from "@/lib/domain/permissions";
import { serviceClient } from "@/lib/server/db";
import { paymentSetup } from "@/lib/server/providers";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

const QB_MESSAGES: Record<string, [boolean, string]> = {
  connected: [true, "QuickBooks Payments is connected."],
  denied: [false, "Authorization was cancelled in QuickBooks. Nothing was connected."],
  bad_state: [false, "The connection attempt could not be verified. Please start again."],
  failed: [false, "QuickBooks did not accept the authorization. Please start again."],
  not_configured: [false, "QuickBooks is not configured. Set the Vercel variables listed below first."],
};

export default async function Payments({ searchParams }: { searchParams: Promise<{ qb?: string }> }) {
  const staff = await requireStaff();
  const { qb } = await searchParams;
  const setup = await paymentSetup();
  const db = serviceClient();
  const now = new Date();
  const stale = new Date(now.getTime() - 5 * 60_000).toISOString();
  const [recent, stuck, events, pendingRefunds] = await Promise.all([
    db.from("payments").select("id, order_id, provider, mode, status, amount_cents, refunded_cents, created_at, orders(number)").order("created_at", { ascending: false }).limit(20),
    db.from("payments").select("id, order_id, status, created_at, orders(number)").in("status", ["authorizing", "authorized"]).lt("created_at", stale),
    db.from("payment_events").select("provider, event_id, type, received_at").order("received_at", { ascending: false }).limit(10),
    db.from("refunds").select("id, order_id, amount_cents, created_at, orders(number)").eq("status", "pending").lt("created_at", stale),
  ]);
  const num = (r: unknown) => (r as { orders: { number: number } | null }).orders?.number;
  const needsReview = [...(stuck.data ?? []), ...(pendingRefunds.data ?? [])];
  const msg = qb ? QB_MESSAGES[qb] : undefined;
  return (
    <>
      <h1>Payments</h1>
      <p>
        <span className={`adm-pill ${setup.mode === "disabled" ? "warn" : ""}`}>{setup.mode}</span>{" "}
        <span className={`adm-pill ${setup.connected ? "" : "warn"}`}>{setup.connected === null ? (setup.mode === "disabled" ? "not connected" : "nothing to connect (mock)") : setup.connected ? "connected" : "not connected"}</span>{" "}
        <span className={`adm-pill ${setup.productionReady ? "" : "warn"}`}>{setup.productionReady ? "production-ready" : "not production-ready"}</span>
      </p>
      <p className="adm-note">{setup.detail}</p>
      {msg && <p className={msg[0] ? "adm-note" : "adm-alert"} role={msg[0] ? "status" : "alert"}>{msg[1]}</p>}
      <p className="adm-note">Live payments run only when APP_ENV is production AND COMPADRES_PAYMENT_PRODUCTION_APPROVED is true. Neither is a statement that the processor has approved tobacco sales: that approval must be confirmed with the processor in writing before going live. Card data never reaches this site; only processor tokens do.</p>

      {setup.name === "quickbooks" && can(staff.role, "manage_payments") && (
        <>
          <h2>QuickBooks Payments connection</h2>
          <p><a className="adm-btn" href="/admin/payments/quickbooks/connect">{setup.connected ? "Reconnect QuickBooks" : "Connect QuickBooks"}</a></p>
        </>
      )}
      <h2>Webhook</h2>
      <p className="adm-note">Point the processor at <code>/api/webhooks/payments</code> on this site. Requests without a valid signature are rejected, and each event is processed once.</p>

      {needsReview.length > 0 && (
        <>
          <h2>Needs review</h2>
          <p className="adm-alert" role="alert">These have been in progress for more than 5 minutes. A payment stuck here blocks a second charge on that order until someone checks the processor.</p>
          <ul>{(stuck.data ?? []).map((p) => <li key={p.id}><Link href={`/admin/orders/${p.order_id}`}>Order #{num(p)}</Link>: payment {p.status} since {new Date(p.created_at).toLocaleString()}</li>)}
            {(pendingRefunds.data ?? []).map((r) => <li key={r.id}><Link href={`/admin/orders/${r.order_id}`}>Order #{num(r)}</Link>: refund of {formatUsd(r.amount_cents)} still pending</li>)}</ul>
        </>
      )}

      <h2>Recent payments</h2>
      {(recent.data ?? []).length === 0 ? <p>No payment attempts yet.</p> : (
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>When</th><th>Order</th><th>Processor</th><th>Status</th><th>Amount</th><th>Refunded</th></tr></thead>
          <tbody>{(recent.data ?? []).map((p) => (
            <tr key={p.id}><td>{new Date(p.created_at).toLocaleString()}</td><td><Link href={`/admin/orders/${p.order_id}`}>#{num(p)}</Link></td><td>{p.provider} ({p.mode})</td><td>{p.status}</td><td>{formatUsd(p.amount_cents)}</td><td>{formatUsd(p.refunded_cents)}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <h2>Recent webhook events</h2>
      {(events.data ?? []).length === 0 ? <p>None received.</p> : (
        <ul>{(events.data ?? []).map((e) => <li key={`${e.provider}${e.event_id}`}>{new Date(e.received_at).toLocaleString()}: {e.provider} {e.type}</li>)}</ul>
      )}
    </>
  );
}
