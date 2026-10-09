import Link from "next/link";
import { ImagePicker } from "@/components/ImagePicker";
import { stockState } from "@/lib/domain/inventory";
import { can } from "@/lib/domain/permissions";
import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";
import { addProductImageAction, removeProductAction, removeProductImageAction, updateProductAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

const ERRORS: Record<string, string> = {
  image_too_large: "That image is larger than 4 MB.", image_bad_type: "Only JPEG, PNG or WebP images are accepted.", image_error: "The image could not be saved. Please try again.",
  confirm: "Tick the confirmation box to remove a product.",
  has_orders: "has been ordered before, so it cannot be deleted (order records need it). It was unpublished instead and is hidden from the store.",
  invalid: "That change was not valid.", weight: "Enter the box weight (oz) before publishing: FedEx cannot quote shipping without it.", price: "A published product needs a price above $0.00.",
};

export default async function Products({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; removed?: string; filter?: string; n?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const { data } = await serviceClient().from("products").select("id, sku, name, price_cents, stock, active, weight_oz, low_stock_threshold, placeholder_price, brands(name), product_images(id, path, position)").order("name");
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
      {sp.removed && <p className="adm-note" role="status">Product removed.</p>}
      {sp.error && <p className="adm-alert" role="alert">{(sp.error === "weight" || sp.error === "has_orders") && sp.n ? `${sp.n.slice(0, 80)}${sp.error === "weight" ? " was not published. " : " "}` : ""}{ERRORS[sp.error] ?? ERRORS.invalid}</p>}
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
                <td><strong>{p.name}</strong><br /><small className="adm-muted">{p.sku} · {(p.brands as unknown as { name: string } | null)?.name}</small>{p.placeholder_price && <><br /><span className="adm-pill warn">placeholder price</span></>}
                  <div className="adm-thumbs">
                    {[...(p.product_images as { id: string; path: string; position: number }[])].sort((a, b) => a.position - b.position).map((im) => (
                      <div key={im.id} className="adm-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={im.path} alt={`${p.name} photo ${im.position + 1}`} width={64} height={64} loading="lazy" />
                        {edit && <form action={removeProductImageAction}><input type="hidden" name="imageId" value={im.id} /><button className="adm-link" type="submit" aria-label={`Remove photo ${im.position + 1} of ${p.name}`}>Remove</button></form>}
                      </div>
                    ))}
                  </div>
                  {edit && (
                    <form action={addProductImageAction} className="adm-inline adm-photo-form">
                      <input type="hidden" name="productId" value={p.id} />
                      <ImagePicker name="imageFile" label="Add photo" required />
                      <button className="adm-btn" type="submit" aria-label={`Upload photo for ${p.name}`}>Upload</button>
                    </form>
                  )}</td>
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
                    <details className="adm-details">
                      <summary>Remove this product</summary>
                      <form action={removeProductAction} className="adm-inline">
                        <input type="hidden" name="productId" value={p.id} />
                        <label className="adm-check"><input type="checkbox" name="confirm" required />Yes, remove {p.name}. This cannot be undone.</label>
                        <button className="adm-btn adm-danger" type="submit" aria-label={`Remove ${p.name}`}>Remove</button>
                      </form>
                    </details>
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
