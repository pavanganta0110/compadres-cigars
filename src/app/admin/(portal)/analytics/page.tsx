import { loadOrders, loadSalesLines, loadStockAlerts } from "@/lib/server/admin-data";
import { requireStaff } from "@/lib/server/staff";
import { SalesPanel } from "../SalesPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default async function Analytics() {
  await requireStaff("view_reports");
  const now = new Date();
  const [orders, lines, alerts] = await Promise.all([loadOrders({ sinceDays: 30 }), loadSalesLines(30), loadStockAlerts()]);
  return (
    <>
      <h1>Analytics</h1>
      <p className="adm-note">Gross sales from paid orders (processing, packed, completed, refunded). Pending and cancelled orders are not counted, and refunds are not subtracted here; see Sales &amp; Tax for refunds.</p>
      <SalesPanel orders={orders} lines={lines} alerts={alerts} now={now} days={30} />
    </>
  );
}
