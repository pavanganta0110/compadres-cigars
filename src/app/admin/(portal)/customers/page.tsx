import Link from "next/link";
import { can } from "@/lib/domain/permissions";
import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const db = serviceClient();
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "").slice(0, 80);
  let query = db.from("customers").select("id, email, full_name, created_at, erased_at, marketing_opt_in, marketing_opt_out_at, orders(id)").is("erased_at", null).order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (sp.filter === "marketing") query = query.eq("marketing_opt_in", true);
  const [{ data }, total, optIn] = await Promise.all([
    query,
    db.from("customers").select("id", { count: "exact", head: true }).is("erased_at", null),
    db.from("customers").select("id", { count: "exact", head: true }).is("erased_at", null).eq("marketing_opt_in", true),
  ]);
  const canExport = can(staff.role, "export_customers");
  return (
    <>
      <div className="adm-head">
        <h1>Customers</h1>
        {canExport && <a className="adm-btn" href={`/admin/customers/export${sp.filter === "marketing" ? "?filter=marketing" : ""}`}>Export {sp.filter === "marketing" ? "subscribers" : "all emails"} (CSV)</a>}
      </div>
      <div className="adm-kpis">
        <div className="adm-kpi"><span>Customer emails stored</span><strong>{total.count ?? 0}</strong><small>every buyer, saved when the order is placed</small></div>
        <div className="adm-kpi"><span>Agreed to marketing</span><strong>{optIn.count ?? 0}</strong><small>ticked the checkout box</small></div>
      </div>
      <p className="adm-note">Only customers who ticked &ldquo;Email me news and offers&rdquo; may receive marketing. Everyone else can only be sent order emails. Check the rules for tobacco marketing, and that your email marketing service allows tobacco, before sending any.</p>
      <p className="adm-tabs">
        <Link href="/admin/customers" aria-current={sp.filter === "marketing" ? undefined : "page"}>All</Link>
        <Link href="/admin/customers?filter=marketing" aria-current={sp.filter === "marketing" ? "page" : undefined}>Marketing opt-in</Link>
      </p>
      <form method="get" className="adm-inline">
        {sp.filter && <input type="hidden" name="filter" value={sp.filter} />}
        <label>Search by email or name<input name="q" defaultValue={q} maxLength={80} /></label>
        <button className="adm-btn" type="submit">Search</button>
      </form>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Email</th><th>Name</th><th>Orders</th><th>Marketing</th><th>Joined</th></tr></thead>
        <tbody>
          {(data ?? []).map((c) => (
            <tr key={c.id}>
              <td>{c.email}</td><td>{c.full_name}</td><td>{(c.orders as unknown[]).length}</td>
              <td>{c.marketing_opt_in ? <span className="adm-pill">Subscribed</span> : c.marketing_opt_out_at ? <span className="adm-pill amber">Unsubscribed</span> : <span className="adm-muted">Not subscribed</span>}</td>
              <td>{new Date(c.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {(data ?? []).length === 0 && <tr><td colSpan={5}>No customers found.</td></tr>}
        </tbody>
      </table></div>
      <p className="adm-muted">Showing up to 200. The CSV export has everyone.</p>
    </>
  );
}
