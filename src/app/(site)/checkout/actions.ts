"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { messageFor } from "@/lib/domain/messages";
import type { ShippingRate } from "@/lib/domain/shipping";
import { writeCart } from "@/lib/server/cart-store";
import { CHECKOUT_SESSION_COOKIE, CheckoutForm, placeOrder } from "@/lib/server/checkout-service";
import { quoteShipping } from "@/lib/server/quote";

export type QuoteState = { rates: ShippingRate[]; quotedFor: string; error?: string };

const Dest = z.object({ state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/), postalCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/) });

/** Step 1: live shipping rates for a destination. Rates are re-fetched server-side when the order is placed. */
export async function quoteAction(_prev: QuoteState, formData: FormData): Promise<QuoteState> {
  const d = Dest.safeParse(Object.fromEntries(formData));
  if (!d.success) return { rates: [], quotedFor: "", error: messageFor("invalid_form") };
  const r = await quoteShipping(d.data.state, d.data.postalCode);
  if (!r.ok) return { rates: [], quotedFor: "", error: messageFor(r.code) ?? messageFor("unexpected") };
  return { rates: r.rates, quotedFor: `${d.data.state}|${d.data.postalCode}` };
}

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
