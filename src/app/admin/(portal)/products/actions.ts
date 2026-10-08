"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { slugify } from "@/lib/domain/inventory";
import { serviceClient } from "@/lib/server/db";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

const Weight = z.string().trim().regex(/^(\d{1,4}(\.\d{1,2})?)?$/);
const Form = z.object({
  productId: z.string().uuid(),
  price: z.string().trim().regex(/^\d{1,5}(\.\d{1,2})?$/),
  stock: z.coerce.number().int().min(0).max(100000),
  lowStock: z.coerce.number().int().min(0).max(100000),
  weightOz: Weight,
  active: z.string().optional(),
});

/** A product with no known weight cannot be rated by FedEx (checkout fails closed), so it must not be published. */
const needsWeight = (active: boolean, weight: string) => active && weight === "";

export async function updateProductAction(formData: FormData) {
  const staff = await requireStaff("manage_products");
  const p = Form.safeParse(Object.fromEntries(formData));
  if (!p.success) redirect("/admin/products?error=invalid");
  const active = p.data.active === "on";
  if (needsWeight(active, p.data.weightOz)) redirect("/admin/products?error=weight");
  const price_cents = Math.round(Number(p.data.price) * 100);
  if (active && price_cents <= 0) redirect("/admin/products?error=price");
  const db = serviceClient();
  const { data: before } = await db.from("products").select("price_cents, stock, active, weight_oz, low_stock_threshold").eq("id", p.data.productId).maybeSingle();
  if (!before) redirect("/admin/products?error=invalid");
  const patch = {
    price_cents, stock: p.data.stock, active, low_stock_threshold: p.data.lowStock, weight_oz: p.data.weightOz === "" ? null : Number(p.data.weightOz),
    ...(price_cents !== before.price_cents ? { placeholder_price: false } : {}),
  };
  await db.from("products").update(patch).eq("id", p.data.productId);
  await auditAdmin(staff.id, before.active !== active ? (active ? "product.published" : "product.unpublished") : "product.updated", "products", p.data.productId, {
    from: before, to: { price_cents, stock: patch.stock, active, weight_oz: patch.weight_oz, low_stock_threshold: patch.low_stock_threshold },
  });
  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/shop");
  redirect("/admin/products?saved=1");
}

const NewProduct = z.object({
  brandId: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/),
  price: z.string().trim().regex(/^\d{1,5}(\.\d{1,2})?$/),
  stock: z.coerce.number().int().min(0).max(100000),
  lowStock: z.coerce.number().int().min(0).max(100000).default(5),
  boxQuantity: z.coerce.number().int().min(1).max(1000),
  weightOz: Weight,
  shortDescription: z.string().trim().max(300).optional().default(""),
  description: z.string().trim().max(4000).optional().default(""),
  image: z.string().trim().regex(/^(\/images\/[A-Za-z0-9._/-]{1,120})?$/).optional().default(""),
  publish: z.string().optional(),
});

/** Launch a new product. It is created as a DRAFT unless "Publish now" is ticked; drafts never appear in the store. */
export async function createProductAction(formData: FormData) {
  const staff = await requireStaff("manage_products");
  const p = NewProduct.safeParse(Object.fromEntries(formData));
  if (!p.success) redirect("/admin/products/new?error=invalid");
  const publish = p.data.publish === "on";
  const price_cents = Math.round(Number(p.data.price) * 100);
  if (price_cents <= 0) redirect("/admin/products/new?error=price");
  if (needsWeight(publish, p.data.weightOz)) redirect("/admin/products/new?error=weight");
  const slug = slugify(p.data.name);
  if (!slug) redirect("/admin/products/new?error=invalid");
  const db = serviceClient();
  const { data, error } = await db.from("products").insert({
    brand_id: p.data.brandId, slug, sku: p.data.sku, name: p.data.name, short_description: p.data.shortDescription || null, description: p.data.description || null,
    price_cents, stock: p.data.stock, low_stock_threshold: p.data.lowStock, box_quantity: p.data.boxQuantity,
    weight_oz: p.data.weightOz === "" ? null : Number(p.data.weightOz), placeholder_price: false, active: publish,
  }).select("id").maybeSingle();
  if (error || !data) redirect(`/admin/products/new?error=${error?.code === "23505" ? "duplicate" : "invalid"}`);
  if (p.data.image) await db.from("product_images").insert({ product_id: data.id, path: p.data.image, alt: p.data.name, position: 0 });
  await auditAdmin(staff.id, "product.created", "products", data.id, { sku: p.data.sku, name: p.data.name, published: publish, price_cents, stock: p.data.stock });
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect(`/admin/products?saved=1`);
}
