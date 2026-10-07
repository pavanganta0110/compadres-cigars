import { describe, expect, it } from "vitest";
import { calculateTax, TAX_RATES_BPS } from "./tax";

describe("tax", () => {
  it("has exactly the 50 approved states and no DC", () => {
    expect(Object.keys(TAX_RATES_BPS)).toHaveLength(50);
    expect(TAX_RATES_BPS.DC).toBeUndefined();
  });
  it("Missouri 8.44% on $149.00", () => {
    const r = calculateTax("mo", 14900);
    expect(r.ok && r.snapshot.tax_cents).toBe(1258); // 14900 * 0.0844 = 1257.56, rounds half up
  });
  it("zero-rate states are explicit rules, not missing", () => {
    for (const s of ["DE", "MT", "NH", "OR"]) {
      const r = calculateTax(s, 14900);
      expect(r.ok && r.snapshot.tax_cents).toBe(0);
    }
  });
  it("fails closed for DC, junk, prototype keys and bad amounts", () => {
    for (const s of ["DC", "", "ZZ", "__proto__", "constructor", "PR"]) expect(calculateTax(s, 100).ok).toBe(false);
    expect(calculateTax("MO", -1).ok).toBe(false);
    expect(calculateTax("MO", 1.5).ok).toBe(false);
  });
  it("snapshot carries provenance and estimate flags; shipping is non-taxable", () => {
    const r = calculateTax("TX", 10000);
    if (!r.ok) throw new Error("x");
    expect(r.snapshot).toMatchObject({ shipping_taxable: false, estimate: true, rate_bps: 820, tax_cents: 820 });
    expect(r.snapshot.source_sha256).toBe("802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3");
  });
});
