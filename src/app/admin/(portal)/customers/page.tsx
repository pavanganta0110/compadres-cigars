import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

export default async function Customers() {
  await requireStaff();
  const { data } = await serviceClient().from("customers").select("id, email, full_name, created_at, erased_at, orders(id)").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <h1>Customers</h1>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Email</th><th>Name</th><th>Orders</th><th>Joined</th></tr></thead>
        <tbody>
          {(data ?? []).map((c) => <tr key={c.id}><td>{c.erased_at ? "[erased]" : c.email}</td><td>{c.full_name}</td><td>{(c.orders as unknown[]).length}</td><td>{new Date(c.created_at).toLocaleDateString()}</td></tr>)}
          {(data ?? []).length === 0 && <tr><td colSpan={4}>No customers yet.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
