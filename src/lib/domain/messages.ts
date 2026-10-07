/** Fixed customer-facing messages keyed by failure code. Error text is never echoed from URLs. */
export const CHECKOUT_MESSAGES: Record<string, string> = {
  cart_empty: "Your cart is empty.",
  bad_quantity: "One of your quantities is invalid.",
  stock_unavailable: "One of the items in your cart is no longer available in that quantity.",
  geo_blocked: "We cannot ship tobacco products to this destination.",
  age_not_verified: "You must confirm that you are 21 years of age or older to place an order.",
  shipping_ineligible: "Please choose an available shipping service that supports adult signature delivery.",
  tax_unsupported: "We cannot calculate tax for this destination.",
  tax_mismatch: "Pricing changed while you were checking out. Please review and try again.",
  price_changed: "Pricing changed while you were checking out. Please review and try again.",
  duplicate_order: "This order has already been placed. Check your email for confirmation before submitting again.",
  locked: "Your order is already being processed. Please wait a moment before trying again.",
  invalid_form: "Please check the highlighted details and try again.",
  unexpected: "We could not place your order. Please try again.",
};
export const messageFor = (code: string | undefined) => (code && CHECKOUT_MESSAGES[code]) || undefined;
