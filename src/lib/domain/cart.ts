import { z } from "zod";

export const CART_COOKIE = "cc_cart";
export const MAX_LINES = 20;
const uuid = z.string().uuid();
const Cart = z.array(z.object({ p: uuid, q: z.number().int().min(1).max(99) })).max(MAX_LINES);
export type CartItem = { productId: string; quantity: number };

/** The cart cookie only names products and quantities. Prices and stock are ALWAYS re-read from the database. */
export function parseCart(raw: string | undefined): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = Cart.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.map((x) => ({ productId: x.p, quantity: x.q })) : [];
  } catch { return []; }
}
export function serializeCart(items: CartItem[]): string {
  return JSON.stringify(items.slice(0, MAX_LINES).map((i) => ({ p: i.productId, q: i.quantity })));
}
export function addToCart(items: CartItem[], productId: string, qty: number): CartItem[] {
  const q = Math.max(1, Math.min(99, Math.trunc(qty)));
  const existing = items.find((i) => i.productId === productId);
  if (existing) return items.map((i) => (i === existing ? { ...i, quantity: Math.min(99, i.quantity + q) } : i));
  return items.length >= MAX_LINES ? items : [...items, { productId, quantity: q }];
}
