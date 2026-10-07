import { formatUsd } from "@/lib/domain/money";
import { isPaid } from "@/lib/domain/operations";
import { loadOrders } from "@/lib/server/admin-data";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default async function Analytics() {
  await requireStaff("view_reports");
  const orders = (await loadOrders({ sinceDays: 30 })).filter((o) => isPaid(o.status));
  const byDay = new Map<string, { n: number; cents: number }>();
  for (const o of orders) { const d = o.created_at.slice(0, 10); const x = byDay.get(d) ?? { n: 0, cents: 0 }; x.n++; x.cents += o.total_cents; byDay.set(d, x); }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  return (
    <>
      <h1>Analytics</h1>
      <p className="adm-note">Paid orders in the last 30 days (processing, packed, completed, refunded).</p>
      <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Day</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>
        {days.map(([d, x]) => <tr key={d}><td>{d}</td><td>{x.n}</td><td>{formatUsd(x.cents)}</td></tr>)}
        {days.length === 0 && <tr><td colSpan={3}>No paid orders yet.</td></tr>}
      </tbody></table></div>
    </>
  );
}
