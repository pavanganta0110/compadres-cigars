import Link from "next/link";
import { formatUsd } from "@/lib/domain/money";
import { loadOrders } from "@/lib/server/admin-data";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

export default async function Orders() {
  await requireStaff();
  const orders = await loadOrders({ limit: 200 });
  return (
    <>
      <h1>Orders</h1>
      <p className="adm-note">Store → Orders. Customers are listed under <Link href="/admin/customers">Customers</Link>.</p>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>State</th><th>Status</th><th>Total</th><th>Tracking</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}><td><Link href={`/admin/orders/${o.id}`}>#{o.number}</Link></td><td>{new Date(o.created_at).toLocaleDateString()}</td>
              <td>{o.email}</td><td>{o.state}</td><td>{o.status}</td><td>{formatUsd(o.total_cents)}</td><td>{o.tracking_number ?? ""}</td></tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={7}>No orders yet.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
