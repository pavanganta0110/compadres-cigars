import "server-only";
import { totalWeightOz } from "@/lib/domain/checkout";
import { evaluateDestination } from "@/lib/domain/restrictions";
import type { ShippingRate } from "@/lib/domain/shipping";
import { readCart, resolveLines } from "./cart-store";
import { loadRestrictions } from "./checkout-service";
import { shippingProvider } from "./providers";

export type QuoteResult = { ok: true; rates: ShippingRate[] } | { ok: false; code: string };

/** Checkout step 1: destination check first (never ask FedEx about blocked states), then live server-side rates. */
export async function quoteShipping(state: string, postalCode: string): Promise<QuoteResult> {
  const lines = await resolveLines(await readCart());
  if (lines.length === 0) return { ok: false, code: "cart_empty" };
  const geo = evaluateDestination("US", state, await loadRestrictions());
  if (!geo.allowed) return { ok: false, code: geo.code };
  const rates = await shippingProvider().provider.rates({
    state, postalCode, totalUnits: lines.reduce((n, l) => n + l.quantity, 0), weightOz: totalWeightOz(lines),
  });
  const usable = rates.filter((r) => r.adultSignature);
  return usable.length ? { ok: true, rates: usable } : { ok: false, code: "no_rates" };
}
