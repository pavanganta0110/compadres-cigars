"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serviceClient } from "@/lib/server/db";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

const Form = z.object({
  productId: z.string().uuid(),
  price: z.string().trim().regex(/^\d{1,5}(\.\d{1,2})?$/),
  stock: z.coerce.number().int().min(0).max(100000),
  weightOz: z.string().trim().regex(/^(\d{1,4}(\.\d{1,2})?)?$/),
  active: z.string().optional(),
});

export async function updateProductAction(formData: FormData) {
  const staff = await requireStaff("manage_products");
  const p = Form.safeParse(Object.fromEntries(formData));
  if (!p.success) redirect("/admin/products?error=invalid");
  const db = serviceClient();
  const { data: before } = await db.from("products").select("price_cents, stock, active, weight_oz").eq("id", p.data.productId).maybeSingle();
  if (!before) redirect("/admin/products?error=invalid");
  const price_cents = Math.round(Number(p.data.price) * 100);
  const patch = { price_cents, stock: p.data.stock, active: p.data.active === "on", weight_oz: p.data.weightOz === "" ? null : Number(p.data.weightOz), ...(price_cents !== before.price_cents ? { placeholder_price: false } : {}) };
  await db.from("products").update(patch).eq("id", p.data.productId);
  await auditAdmin(staff.id, "product.updated", "products", p.data.productId, { from: before, to: { price_cents, stock: patch.stock, active: patch.active, weight_oz: patch.weight_oz } });
  revalidatePath("/admin/products");
  redirect("/admin/products?saved=1");
}
