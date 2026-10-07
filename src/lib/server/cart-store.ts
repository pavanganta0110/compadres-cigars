import "server-only";
import { cookies } from "next/headers";
import { CART_COOKIE, parseCart, serializeCart, type CartItem } from "@/lib/domain/cart";
import type { CartLine } from "@/lib/domain/checkout";
import { serviceClient } from "./db";

const OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 14, secure: process.env.NODE_ENV === "production" };

export async function readCart(): Promise<CartItem[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}
export async function writeCart(items: CartItem[]) {
  const jar = await cookies();
  if (items.length === 0) jar.delete(CART_COOKIE);
  else jar.set(CART_COOKIE, serializeCart(items), OPTS);
}

/** Resolves cart items against the database. Prices and stock are authoritative here; the cookie holds neither. */
export async function resolveLines(items: CartItem[]): Promise<(CartLine & { slug: string; image: string | null })[]> {
  if (items.length === 0) return [];
  const { data, error } = await serviceClient()
    .from("products").select("id, slug, sku, name, price_cents, stock, product_images(path, position)")
    .in("id", items.map((i) => i.productId)).eq("active", true);
  if (error) throw error;
  const byId = new Map((data ?? []).map((p) => [p.id as string, p]));
  return items.flatMap((i) => {
    const p = byId.get(i.productId);
    if (!p) return [];
    const imgs = [...((p.product_images as { path: string; position: number }[]) ?? [])].sort((a, b) => a.position - b.position);
    return [{ productId: p.id, slug: p.slug, sku: p.sku, name: p.name, quantity: i.quantity, unitPriceCents: p.price_cents, stock: p.stock, image: imgs[0]?.path ?? null }];
  });
}
