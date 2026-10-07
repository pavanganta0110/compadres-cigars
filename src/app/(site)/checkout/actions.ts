"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { writeCart } from "@/lib/server/cart-store";
import { CHECKOUT_SESSION_COOKIE, CheckoutForm, placeOrder } from "@/lib/server/checkout-service";

export async function placeOrderAction(formData: FormData) {
  const jar = await cookies();
  if (!jar.get(CHECKOUT_SESSION_COOKIE)) {
    jar.set(CHECKOUT_SESSION_COOKIE, crypto.randomUUID(), { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  }
  const parsed = CheckoutForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/checkout?error=invalid_form");
  // Only the literal checkbox value counts. Hidden "verified/passed" fields from a client are never read.
  const attested = formData.get("ageAttest") === "yes";
  const r = await placeOrder(parsed.data, attested);
  if (!r.ok) redirect(`/checkout?error=${encodeURIComponent(r.code)}`);
  await writeCart([]);
  redirect(`/order/${r.orderId}`);
}
