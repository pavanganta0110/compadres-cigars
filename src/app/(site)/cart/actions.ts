"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addToCart } from "@/lib/domain/cart";
import { readCart, writeCart } from "@/lib/server/cart-store";

const Id = z.string().uuid();

export async function addToCartAction(formData: FormData) {
  const id = Id.safeParse(formData.get("productId"));
  if (!id.success) redirect("/shop");
  await writeCart(addToCart(await readCart(), id.data, 1));
  redirect("/cart");
}

export async function updateCartAction(formData: FormData) {
  const id = Id.safeParse(formData.get("productId"));
  const qty = z.coerce.number().int().min(0).max(99).safeParse(formData.get("quantity"));
  if (!id.success || !qty.success) redirect("/cart");
  const items = (await readCart()).flatMap((i) => (i.productId !== id.data ? [i] : qty.data === 0 ? [] : [{ ...i, quantity: qty.data }]));
  await writeCart(items);
  redirect("/cart");
}
