import Link from "next/link";
import { stockState } from "@/lib/domain/inventory";
import { can } from "@/lib/domain/permissions";
import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";
import { updateProductAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

const ERRORS: Record<string, string> = {
  invalid: "That change was not valid.", weight: "Enter the box weight (oz) before publishing: FedEx cannot quote shipping without it.", price: "A published product needs a price above $0.00.",
};

export default async function Products({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; filter?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const { data } = await serviceClient().from("products").select("id, sku, name, price_cents, stock, active, weight_oz, low_stock_threshold, placeholder_price, brands(name)").order("name");
  const edit = can(staff.role, "manage_products");
  const all = data ?? [];
  const attention = all.filter((p) => p.active && stockState(p.stock, p.low_stock_threshold) !== "ok");
  const rows = sp.filter === "low" ? attention : all;
  return (
    <>
      <div className="adm-head">
        <h1>Products &amp; inventory</h1>
        {edit && <Link className="adm-btn" href="/admin/products/new">Add product</Link>}
      </div>
      {sp.saved && <p className="adm-note" role="status">Saved.</p>}
      {sp.error && <p className="adm-alert" role="alert">{ERRORS[sp.error] ?? ERRORS.invalid}</p>}
      <p className="adm-tabs">
        <Link href="/admin/products" aria-current={sp.filter === "low" ? undefined : "page"}>All ({all.length})</Link>
        <Link href="/admin/products?filter=low" aria-current={sp.filter === "low" ? "page" : undefined}>Needs restocking ({attention.length})</Link>
      </p>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Product</th><th>Status</th>{edit ? <th>Edit</th> : <><th>Price</th><th>Stock</th></>}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={3}>Nothing needs restocking.</td></tr>}
          {rows.map((p) => {
            const st = stockState(p.stock, p.low_stock_threshold);
            return (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><br /><small className="adm-muted">{p.sku} · {(p.brands as unknown as { name: string } | null)?.name}</small>{p.placeholder_price && <><br /><span className="adm-pill warn">placeholder price</span></>}</td>
                <td>
                  <span className={`adm-pill ${p.active ? "" : "amber"}`}>{p.active ? "Published" : "Draft"}</span>{" "}
                  {st !== "ok" && <span className={`adm-pill ${st === "out" ? "warn" : "amber"}`}>{st === "out" ? "Out of stock" : "Low stock"}</span>}
                </td>
                {edit ? (
                  <td>
                    <form action={updateProductAction} className="adm-inline">
                      <input type="hidden" name="productId" value={p.id} />
                      <label>Price<input name="price" defaultValue={(p.price_cents / 100).toFixed(2)} inputMode="decimal" required /></label>
                      <label>Stock<input name="stock" type="number" min={0} defaultValue={p.stock} required /></label>
                      <label>Alert at<input name="lowStock" type="number" min={0} defaultValue={p.low_stock_threshold} required /></label>
                      <label>Weight (oz)<input name="weightOz" inputMode="decimal" defaultValue={p.weight_oz ?? ""} placeholder="for FedEx" /></label>
                      <label className="adm-check"><input type="checkbox" name="active" defaultChecked={p.active} />Published</label>
                      <button className="adm-btn" type="submit">Save</button>
                    </form>
                  </td>
                ) : (<><td>{(p.price_cents / 100).toFixed(2)}</td><td>{p.stock}</td></>)}
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </>
  );
}
