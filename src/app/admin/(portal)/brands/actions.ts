"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { describeInvalid } from "@/lib/domain/form-errors";
import { slugify } from "@/lib/domain/inventory";
import { serviceClient } from "@/lib/server/db";
import { deleteImage, saveImage } from "@/lib/server/media";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

const Text = {
  tagline: z.string().trim().max(120).optional().default(""),
  shortDescription: z.string().trim().max(300).optional().default(""),
  story: z.string().trim().max(6000).optional().default(""),
  accentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#d6ad68"),
};
const NewBrand = z.object({ name: z.string().trim().min(2).max(60), ...Text, publish: z.string().optional() });
const EditBrand = z.object({ brandId: z.string().uuid(), ...Text, publish: z.string().optional() });

const bust = () => { for (const p of ["/admin/brands", "/admin/products", "/shop", "/"]) revalidatePath(p); };
const strings = (fd: FormData) => Object.fromEntries([...fd].filter(([, v]) => typeof v === "string"));

/** New brands start unpublished: a brand that is not published hides itself AND all of its products from the store. */
export async function createBrandAction(formData: FormData) {
  const staff = await requireStaff("manage_products");
  const p = NewBrand.safeParse(strings(formData));
  if (!p.success) redirect(`/admin/brands/new?error=invalid&detail=${encodeURIComponent(describeInvalid(p.error.issues))}`);
  const slug = slugify(p.data.name);
  if (!slug) redirect("/admin/brands/new?error=invalid");
  const db = serviceClient();
  const logo = await saveImage(formData.get("logo"), staff.id);
  const hero = await saveImage(formData.get("hero"), staff.id);
  for (const r of [logo, hero]) if (!r.ok && r.code !== "no_file") redirect(`/admin/brands/new?error=image_${r.code}`);
  const { data: last } = await db.from("brands").select("display_order").order("display_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await db.from("brands").insert({
    slug, name: p.data.name, tagline: p.data.tagline || null, short_description: p.data.shortDescription || null, story: p.data.story || null,
    accent_color: p.data.accentColor, template: "default", display_order: (last?.display_order ?? 0) + 10, active: p.data.publish === "on",
    logo_path: logo.ok ? logo.path : null, hero_path: hero.ok ? hero.path : null,
  }).select("id").maybeSingle();
  if (error || !data) {
    if (logo.ok) await deleteImage(logo.path);
    if (hero.ok) await deleteImage(hero.path);
    redirect(`/admin/brands/new?error=${error?.code === "23505" ? "duplicate" : "database"}&detail=${encodeURIComponent((error?.message ?? "no row returned").slice(0, 160))}`);
  }
  await auditAdmin(staff.id, "brand.created", "brands", data.id, { name: p.data.name, slug, published: p.data.publish === "on" });
  bust();
  redirect("/admin/brands?saved=1");
}

export async function updateBrandAction(formData: FormData) {
  const staff = await requireStaff("manage_products");
  const p = EditBrand.safeParse(strings(formData));
  if (!p.success) redirect("/admin/brands?error=invalid");
  const db = serviceClient();
  const { data: before } = await db.from("brands").select("active, logo_path, hero_path").eq("id", p.data.brandId).maybeSingle();
  if (!before) redirect("/admin/brands?error=invalid");
  const logo = await saveImage(formData.get("logo"), staff.id);
  const hero = await saveImage(formData.get("hero"), staff.id);
  for (const r of [logo, hero]) if (!r.ok && r.code !== "no_file") redirect(`/admin/brands?error=image_${r.code}`);
  const active = p.data.publish === "on";
  await db.from("brands").update({
    tagline: p.data.tagline || null, short_description: p.data.shortDescription || null, story: p.data.story || null, accent_color: p.data.accentColor, active,
    ...(logo.ok ? { logo_path: logo.path } : {}), ...(hero.ok ? { hero_path: hero.path } : {}),
  }).eq("id", p.data.brandId);
  if (logo.ok) await deleteImage(before.logo_path);
  if (hero.ok) await deleteImage(before.hero_path);
  await auditAdmin(staff.id, before.active !== active ? (active ? "brand.published" : "brand.unpublished") : "brand.updated", "brands", p.data.brandId, { published: active });
  bust();
  redirect("/admin/brands?saved=1");
}

/** Removes a brand only when it has no products (products must be removed or moved first). Requires the confirmation box. */
export async function removeBrandAction(formData: FormData) {
  const staff = await requireStaff("manage_products");
  const id = z.string().uuid().safeParse(formData.get("brandId"));
  if (!id.success) redirect("/admin/brands?error=invalid");
  if (formData.get("confirm") !== "on") redirect("/admin/brands?error=confirm");
  const db = serviceClient();
  const { data: brand } = await db.from("brands").select("name, logo_path, hero_path, products(id)").eq("id", id.data).maybeSingle();
  if (!brand) redirect("/admin/brands?error=invalid");
  if ((brand.products as unknown[]).length > 0) redirect(`/admin/brands?error=has_products&n=${encodeURIComponent(brand.name.slice(0, 60))}`);
  const { error } = await db.from("brands").delete().eq("id", id.data);
  if (error) redirect("/admin/brands?error=invalid");
  await deleteImage(brand.logo_path); await deleteImage(brand.hero_path);
  await auditAdmin(staff.id, "brand.removed", "brands", id.data, { name: brand.name });
  bust();
  redirect("/admin/brands?removed=1");
}
