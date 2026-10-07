/**
 * Sales tax: business-approved "Avg Combined Reference %" by destination state.
 * Source: Compadres_Cigars_50_State_Tobacco_Tax_Matrix_2026.xlsx, sha256 802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3.
 * ESTIMATES ONLY: state averages, not exact local rates. Requires tax-professional review before production.
 * No excise tax, no nexus logic. Shipping is non-taxable. DC and unknown destinations fail closed.
 */
export const TAX_MATRIX_SHA256 = "802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3";
export const TAX_EFFECTIVE_DATE = "2026-08-19";
export const TAX_RULE_VERSION = 1;

/** Rates in basis points (946 = 9.46%). */
export const TAX_RATES_BPS: Readonly<Record<string, number>> = Object.freeze({
  AL: 946,
  AK: 182,
  AZ: 852,
  AR: 946,
  CA: 899,
  CO: 789,
  CT: 635,
  DE: 0,
  FL: 698,
  GA: 749,
  HI: 450,
  ID: 603,
  IL: 896,
  IN: 700,
  IA: 694,
  KS: 869,
  KY: 600,
  LA: 1011,
  ME: 550,
  MD: 600,
  MA: 625,
  MI: 600,
  MN: 814,
  MS: 706,
  MO: 844,
  MT: 0,
  NE: 698,
  NV: 824,
  NH: 0,
  NJ: 660,
  NM: 767,
  NY: 854,
  NC: 700,
  ND: 709,
  OH: 729,
  OK: 906,
  OR: 0,
  PA: 634,
  RI: 700,
  SC: 749,
  SD: 611,
  TN: 961,
  TX: 820,
  UT: 742,
  VT: 639,
  VA: 577,
  WA: 951,
  WV: 659,
  WI: 572,
  WY: 556,
});

export type TaxSnapshot = {
  state: string; rate_bps: number; taxable_cents: number; tax_cents: number; shipping_taxable: false;
  basis: "avg_combined_reference"; source_document: string; source_sha256: string;
  effective_date: string; rule_version: number; is_average_reference: true; estimate: true;
};

export type TaxResult = { ok: true; snapshot: TaxSnapshot } | { ok: false; code: "tax_unsupported" };

export function calculateTax(state: string, taxableCents: number): TaxResult {
  const s = state.trim().toUpperCase();
  if (!Number.isInteger(taxableCents) || taxableCents < 0) return { ok: false, code: "tax_unsupported" };
  if (!Object.hasOwn(TAX_RATES_BPS, s)) return { ok: false, code: "tax_unsupported" };
  const rate = TAX_RATES_BPS[s];
  return {
    ok: true,
    snapshot: {
      state: s, rate_bps: rate, taxable_cents: taxableCents,
      // round half up; identical formula to create_checkout_order() in Postgres
      tax_cents: Math.floor((taxableCents * rate + 5000) / 10000),
      shipping_taxable: false, basis: "avg_combined_reference",
      source_document: "Compadres_Cigars_50_State_Tobacco_Tax_Matrix_2026.xlsx - 50-State Tax Matrix.pdf",
      source_sha256: TAX_MATRIX_SHA256, effective_date: TAX_EFFECTIVE_DATE, rule_version: TAX_RULE_VERSION,
      is_average_reference: true, estimate: true,
    },
  };
}
