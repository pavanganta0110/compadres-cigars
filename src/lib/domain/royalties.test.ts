import { describe, expect, it } from "vitest";
import { checkPayout, computeRoyalties, parseRoyaltyPercent, rateAt, type RateRow, type RoyaltyItem } from "./royalties";
import { can } from "./permissions";

const D = (s: string) => new Date(s);
const order = (id: string, status: string, paid: string, total: number, refunded = 0) => ({ id, status, created_at: paid, paid_at: status === "pending" ? null : paid, total_cents: total, refundedCents: refunded });
const item = (brandId: string | null, q: number, price: number, o: RoyaltyItem["order"]): RoyaltyItem => ({ brandId, quantity: q, unitPriceCents: price, order: o });

describe("rate in effect", () => {
  const rates: RateRow[] = [
    { brand_id: "A", rate_bps: 1000, effective_from: "2026-01-01T00:00:00Z" },
    { brand_id: "A", rate_bps: 1500, effective_from: "2026-06-01T00:00:00Z" },
    { brand_id: "B", rate_bps: 500, effective_from: "2026-03-01T00:00:00Z" },
  ];
  it("uses the latest rate not after the moment, and 0 before any rate", () => {
    expect(rateAt(rates, "A", D("2026-05-31T23:59:59Z"))).toBe(1000);
    expect(rateAt(rates, "A", D("2026-06-01T00:00:00Z"))).toBe(1500);
    expect(rateAt(rates, "A", D("2025-12-31T00:00:00Z"))).toBe(0);
    expect(rateAt(rates, "B", D("2026-02-01T00:00:00Z"))).toBe(0);
    expect(rateAt(rates, "C", D("2026-07-01T00:00:00Z"))).toBe(0);
  });
});

describe("royalty calculation", () => {
  const rates: RateRow[] = [{ brand_id: "A", rate_bps: 1000, effective_from: "2026-01-01T00:00:00Z" }, { brand_id: "B", rate_bps: 250, effective_from: "2026-01-01T00:00:00Z" }];
  it("is rate x item subtotal: tax and shipping are not part of the base", () => {
    // order total includes shipping+tax, but royalty only sees the 2 x $149.00 of cigars
    const o = order("o1", "processing", "2026-10-02T12:00:00Z", 29800 + 1450 + 2515);
    const r = computeRoyalties([item("A", 2, 14900, o)], rates, null, null).get("A")!;
    expect(r).toMatchObject({ units: 2, grossCents: 29800, netCents: 29800, royaltyCents: 2980 });
  });
  it("exact numbers: 10% of $298.00, and 2.5% of another brand's line in the same order", () => {
    const o = order("o1", "processing", "2026-10-02T12:00:00Z", 100000);
    const m = computeRoyalties([item("A", 2, 14900, o), item("B", 1, 12900, o)], rates, null, null);
    expect(m.get("A")).toMatchObject({ grossCents: 29800, netCents: 29800, royaltyCents: 2980 });
    expect(m.get("B")).toMatchObject({ grossCents: 12900, netCents: 12900, royaltyCents: 323 });   // 322.5 rounds half up
  });
  it("only paid orders count; pending and cancelled never earn royalties", () => {
    const m = computeRoyalties([item("A", 1, 10000, order("p", "pending", "2026-10-01T00:00:00Z", 10000)), item("A", 1, 10000, order("c", "cancelled", "2026-10-01T00:00:00Z", 10000)), item("A", 1, 10000, order("k", "completed", "2026-10-01T00:00:00Z", 10000))], rates, null, null);
    expect(m.get("A")!.royaltyCents).toBe(1000);
  });
  it("refunds reduce the royalty in proportion; a full refund removes it", () => {
    const half = computeRoyalties([item("A", 1, 10000, order("h", "processing", "2026-10-01T00:00:00Z", 12000, 6000))], rates, null, null).get("A")!;
    expect(half).toMatchObject({ grossCents: 10000, netCents: 5000, royaltyCents: 500 });
    const full = computeRoyalties([item("A", 1, 10000, order("f", "refunded", "2026-10-01T00:00:00Z", 12000, 12000))], rates, null, null).get("A")!;
    expect(full.royaltyCents).toBe(0);
    const over = computeRoyalties([item("A", 1, 10000, order("o", "processing", "2026-10-01T00:00:00Z", 12000, 99999))], rates, null, null).get("A")!;
    expect(over.royaltyCents).toBe(0);
  });
  it("uses the rate in effect when the order was paid, so a later change does not rewrite history", () => {
    const changing: RateRow[] = [{ brand_id: "A", rate_bps: 1000, effective_from: "2026-01-01T00:00:00Z" }, { brand_id: "A", rate_bps: 2000, effective_from: "2026-10-05T00:00:00Z" }];
    const m = computeRoyalties([item("A", 1, 10000, order("old", "processing", "2026-10-01T00:00:00Z", 10000)), item("A", 1, 10000, order("new", "processing", "2026-10-06T00:00:00Z", 10000))], changing, null, null);
    expect(m.get("A")!.royaltyCents).toBe(1000 + 2000);
  });
  it("filters by the period the order was paid in (from inclusive, to exclusive) and skips unattributed items", () => {
    const items = [item("A", 1, 10000, order("sep", "processing", "2026-09-30T23:59:59Z", 10000)), item("A", 1, 10000, order("oct", "processing", "2026-10-01T00:00:00Z", 10000)), item(null, 5, 10000, order("x", "processing", "2026-10-02T00:00:00Z", 50000))];
    const oct = computeRoyalties(items, rates, D("2026-10-01T00:00:00Z"), D("2026-11-01T00:00:00Z"));
    expect(oct.get("A")!.royaltyCents).toBe(1000);
    expect(oct.size).toBe(1);
  });
});

describe("inputs and permissions", () => {
  it("parses royalty percentages strictly, 0 to 100", () => {
    expect(parseRoyaltyPercent("10")).toBe(1000);
    expect(parseRoyaltyPercent("7.5%")).toBe(750);
    expect(parseRoyaltyPercent("100")).toBe(10000);
    expect(parseRoyaltyPercent("0")).toBe(0);
    for (const bad of ["", "-1", "100.01", "101", "1e2", "5.555", "abc", "1,5"]) expect(parseRoyaltyPercent(bad)).toBeNull();
  });
  it("a payout must be positive and cannot exceed what is owed", () => {
    expect(checkPayout(500, 1000)).toEqual({ ok: true });
    expect(checkPayout(1000, 1000)).toEqual({ ok: true });
    expect(checkPayout(1001, 1000)).toEqual({ ok: false, code: "exceeds_balance" });
    expect(checkPayout(0, 1000)).toEqual({ ok: false, code: "invalid_amount" });
    expect(checkPayout(null, 1000)).toEqual({ ok: false, code: "invalid_amount" });
    expect(checkPayout(1.5, 1000)).toEqual({ ok: false, code: "invalid_amount" });
  });
  it("owner sets rates; managers can view; others see nothing", () => {
    expect(["owner", "manager", "fulfillment", "viewer"].map((r) => can(r, "view_royalties"))).toEqual([true, true, false, false]);
    expect(["owner", "manager", "fulfillment", "viewer"].map((r) => can(r, "manage_royalties"))).toEqual([true, false, false, false]);
  });
});
