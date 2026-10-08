import { allowsCheckout, type AgeVerificationProvider, type VerificationResult } from "./age";
import { evaluateDestination, type RestrictionStatus } from "./restrictions";
import { eligibleService, type ShippingProvider, type ShippingRate } from "./shipping";
import { calculateTax, type TaxRateRow, type TaxSnapshot } from "./tax";

export type CartLine = { productId: string; sku: string; name: string; quantity: number; unitPriceCents: number; stock: number; weightOz?: number | null };
/** Total shipment weight in ounces. Any unknown or non-positive item weight makes the total 0 (rating fails closed). */
export function totalWeightOz(lines: CartLine[]): number {
  let total = 0;
  for (const l of lines) {
    if (typeof l.weightOz !== "number" || !Number.isFinite(l.weightOz) || l.weightOz <= 0) return 0;
    total += l.weightOz * l.quantity;
  }
  return total;
}

export type Destination = { country: string; state: string; postalCode: string };

export type CheckoutStep = "cart_stock" | "geography" | "age_verification" | "shipping_eligibility" | "tax";
export type CheckoutFailure = { ok: false; step: CheckoutStep; code: string; message: string };
export type CheckoutPass = {
  ok: true; subtotalCents: number; shipping: ShippingRate; tax: TaxSnapshot; totalCents: number; age: VerificationResult;
};

export type CheckoutInput = {
  lines: CartLine[]; destination: Destination; restrictions: ReadonlyMap<string, RestrictionStatus>;
  attested: boolean; chosenService: string; ageProvider: AgeVerificationProvider; shippingProvider: ShippingProvider; now: Date;
  /** The live tax_rates table. Omitted only in unit tests (falls back to the built-in approved matrix). */
  taxRates?: ReadonlyMap<string, TaxRateRow>;
};

const fail = (step: CheckoutStep, code: string, message: string): CheckoutFailure => ({ ok: false, step, code, message });

/**
 * Server-side checkout compliance. Order is fixed and the first failure wins:
 * cart/stock -> geography -> age -> Adult Signature determination + shipping eligibility -> tax.
 * Payment happens only AFTER this passes, and this runs again right before order creation.
 * Nothing in the input is trusted from the browser beyond the cart quantities, destination and the checkbox.
 */
export async function evaluateCheckout(i: CheckoutInput): Promise<CheckoutFailure | CheckoutPass> {
  if (i.lines.length === 0) return fail("cart_stock", "cart_empty", "Your cart is empty.");
  for (const l of i.lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 99) return fail("cart_stock", "bad_quantity", "Invalid quantity.");
    if (l.quantity > l.stock) return fail("cart_stock", "stock_unavailable", `${l.name} is not available in that quantity.`);
  }
  const geo = evaluateDestination(i.destination.country, i.destination.state, i.restrictions);
  if (!geo.allowed) return fail("geography", geo.code, geo.message);

  const age = await i.ageProvider.verify({ attested: i.attested });
  if (!allowsCheckout(age, i.now)) return fail("age_verification", "age_not_verified", "You must confirm that you are 21 years of age or older to continue.");

  const totalUnits = i.lines.reduce((n, l) => n + l.quantity, 0);
  const rates = await i.shippingProvider.rates({ state: i.destination.state, postalCode: i.destination.postalCode, totalUnits, weightOz: totalWeightOz(i.lines) });
  const ship = eligibleService(i.chosenService, rates);
  if (!ship.ok) return fail("shipping_eligibility", ship.code, ship.message);

  const subtotalCents = i.lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
  const tax = calculateTax(i.destination.state, subtotalCents, i.taxRates);
  if (!tax.ok) return fail("tax", tax.code, "We cannot calculate tax for this destination.");
  return { ok: true, subtotalCents, shipping: ship.rate, tax: tax.snapshot, totalCents: subtotalCents + ship.rate.cents + tax.snapshot.tax_cents, age };
}
