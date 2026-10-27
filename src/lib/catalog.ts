import { publicClient } from "./supabase/public";
import { collapseVariants, sortVariants } from "./domain/variants";

export type Brand = {
  id: string; slug: string; name: string; tagline: string | null; short_description: string | null;
  story: string | null; logo_path: string | null; hero_path: string | null; accent_color: string | null;
  template: "default" | "isley" | "sugarhill"; display_order: number;
};
export type ProductImage = { path: string; alt: string; position: number };
export type Product = {
  id: string; slug: string; sku: string; name: string; short_description: string | null; description: string | null;
  price_cents: number; stock: number; box_quantity: number; vitola: string | null; length_in: number | null;
  ring_gauge: number | null; country_of_origin: string | null; strength: string | null; wrapper: string | null;
  binder: string | null; filler: string | null; flavor_profile: string | null; placeholder_price: boolean;
  variant_group: string | null; variant_label: string | null;
  brand: Pick<Brand, "slug" | "name" | "template" | "accent_color">;
  images: ProductImage[];
};

const PRODUCT_COLS = `id, slug, sku, name, short_description, description, price_cents, stock, box_quantity, vitola,
  length_in, ring_gauge, country_of_origin, strength, wrapper, binder, filler, flavor_profile, placeholder_price,
  variant_group, variant_label,
  brand:brands!inner(slug, name, template, accent_color), images:product_images(path, alt, position)`;

function normalize(row: unknown): Product {
  const p = row as Product;
  return { ...p, images: [...(p.images ?? [])].sort((a, b) => a.position - b.position) };
}

export async function getBrands(): Promise<Brand[]> {
  const { data, error } = await publicClient().from("brands").select("*").order("display_order");
  if (error) throw error;
  return data as Brand[];
}

export async function getBrand(slug: string): Promise<Brand | null> {
  const { data, error } = await publicClient().from("brands").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as Brand | null) ?? null;
}

export async function getProducts(brandSlug?: string): Promise<Product[]> {
  let q = publicClient().from("products").select(PRODUCT_COLS).order("name");
  if (brandSlug) q = q.eq("brand.slug", brandSlug);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function getProduct(slug: string): Promise<Product | null> {
  const { data, error } = await publicClient().from("products").select(PRODUCT_COLS).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

/** Shop/brand listing: each flavour group appears once, titled by the group and showing the first available photo. */
export async function getListing(brandSlug?: string): Promise<Product[]> {
  const all = await getProducts(brandSlug);
  const groups = new Map<string, Product[]>();
  for (const p of all) if (p.variant_group) groups.set(p.variant_group, [...(groups.get(p.variant_group) ?? []), p]);
  return collapseVariants(all).map((p) => {
    if (!p.variant_group) return p;
    const members = sortVariants(groups.get(p.variant_group) ?? [p]);
    const photo = members.find((m) => m.images.length > 0);
    return { ...members[0], name: p.variant_group, images: photo?.images ?? [] };
  });
}

/** Every product in a variant group (flavours), in dropdown order. */
export async function getVariants(group: string): Promise<Product[]> {
  const { data, error } = await publicClient().from("products").select(PRODUCT_COLS).eq("variant_group", group);
  if (error) throw error;
  return sortVariants((data ?? []).map(normalize));
}

/** Human-readable spec rows; only fields that have approved values are shown. */
export function specRows(p: Product): [string, string][] {
  const rows: [string, string | null][] = [
    ["Box", `${p.box_quantity} cigars`],
    ["Vitola", p.vitola],
    ["Size", p.ring_gauge && p.length_in ? `${p.ring_gauge} × ${p.length_in}` : null],
    ["Origin", p.country_of_origin],
    ["Strength", p.strength],
    ["Wrapper", p.wrapper], ["Binder", p.binder], ["Filler", p.filler],
    ["Flavor", p.flavor_profile],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}
