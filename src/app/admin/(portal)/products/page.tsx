import { can } from "@/lib/domain/permissions";
import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";
import { updateProductAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

export default async function Products({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const { data } = await serviceClient().from("products").select("id, sku, name, price_cents, stock, active, weight_oz, placeholder_price, brands(name)").order("name");
  const edit = can(staff.role, "manage_products");
  return (
    <>
      <h1>Products</h1>
      {sp.saved && <p className="adm-note" role="status">Saved.</p>}
      {sp.error && <p className="adm-alert" role="alert">That change was not valid.</p>}
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>SKU</th><th>Product</th><th>Brand</th><th>Price (USD)</th><th>Stock</th><th>Weight (oz)</th><th>Active</th><th /></tr></thead>
        <tbody>
          {(data ?? []).map((p) => (
            <tr key={p.id}>
              <td>{p.sku}</td><td>{p.name}{p.placeholder_price && <><br /><span className="adm-pill warn">placeholder price</span></>}</td>
              <td>{(p.brands as unknown as { name: string } | null)?.name}</td>
              {edit ? (
                <td colSpan={5}>
                  <form action={updateProductAction} className="adm-inline">
                    <input type="hidden" name="productId" value={p.id} />
                    <label>Price<input name="price" defaultValue={(p.price_cents / 100).toFixed(2)} inputMode="decimal" required /></label>
                    <label>Stock<input name="stock" type="number" min={0} defaultValue={p.stock} required /></label>
                    <label>Box weight (oz)<input name="weightOz" inputMode="decimal" defaultValue={p.weight_oz ?? ""} placeholder="required for FedEx" /></label>
                    <label className="adm-check"><input type="checkbox" name="active" defaultChecked={p.active} />Active</label>
                    <button className="adm-btn" type="submit">Save</button>
                  </form>
                </td>
              ) : (<><td>{(p.price_cents / 100).toFixed(2)}</td><td>{p.stock}</td><td>{p.weight_oz ?? ""}</td><td>{p.active ? "yes" : "no"}</td><td /></>)}
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
