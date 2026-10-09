import Link from "next/link";
import { serviceClient } from "@/lib/server/db";
import { ImagePicker } from "@/components/ImagePicker";
import { requireStaff } from "@/lib/server/staff";
import { createProductAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add product" };

const ERRORS: Record<string, string> = {
  invalid: "Please check the fields and try again.", price: "Enter a price above $0.00.",
  weight: "Enter the box weight in ounces before publishing: FedEx cannot quote shipping without it. You can also save it as a draft.",
  image_too_large: "That image is larger than 4 MB.", image_bad_type: "Only JPEG, PNG or WebP images are accepted.",
  database: "The product could not be saved.",
  duplicate: "A product with that SKU or name already exists.",
};

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ error?: string; detail?: string }> }) {
  await requireStaff("manage_products");
  const { error, detail } = await searchParams;
  const { data: brands } = await serviceClient().from("brands").select("id, name").order("display_order");
  const noBrands = (brands ?? []).length === 0;
  return (
    <>
      <p><Link href="/admin/products">&larr; Products</Link></p>
      <h1>Add a product</h1>
      <p className="adm-note">New products are saved as drafts and stay hidden from the store until you publish them. Cigars are sold by the box.</p>
      {error && <p className="adm-alert" role="alert">{ERRORS[error] ?? ERRORS.invalid}{detail ? ` ${error === "database" ? "Database said" : "Check"}: ${detail.slice(0, 200)}` : ""}</p>}
      <form action={createProductAction} className="adm-form adm-form-wide">
        {noBrands && <p className="adm-alert" role="alert">Add a brand first: <Link href="/admin/brands/new">Add brand</Link>.</p>}
        <label>Brand<select name="brandId" required>{(brands ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <p className="adm-muted">Need a different brand? <Link href="/admin/brands/new">Add a new brand</Link>.</p>
        <label>Product name<input name="name" required minLength={3} maxLength={120} placeholder='Ronald Isley "The Plug" — Box of 10' /></label>
        <label>SKU<input name="sku" required pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,39}" placeholder="ISLEY-PLUG-60X675-10" /></label>
        <div className="adm-row">
          <label>Price (USD)<input name="price" inputMode="decimal" required placeholder="149.00" /></label>
          <label>Stock on hand<input name="stock" type="number" min={0} defaultValue={0} required /></label>
          <label>Alert when stock is at or below<input name="lowStock" type="number" min={0} defaultValue={5} required /></label>
        </div>
        <div className="adm-row">
          <label>Cigars per box<input name="boxQuantity" type="number" min={1} defaultValue={10} required /></label>
          <label>Box weight (oz)<input name="weightOz" inputMode="decimal" placeholder="required to publish" /></label>
        </div>
        <label>Short description<input name="shortDescription" maxLength={300} /></label>
        <label>Description<textarea name="description" rows={5} maxLength={4000} /></label>
        <ImagePicker name="imageFile" label="Photo (optional)" />
        <p className="adm-muted">JPEG, PNG or WebP. Large photos are reduced automatically. You can add more photos from the product list.</p>
        <label className="adm-check"><input type="checkbox" name="publish" />Publish now (visible in the store)</label>
        <p><button className="adm-btn" type="submit">Create product</button></p>
      </form>
    </>
  );
}
