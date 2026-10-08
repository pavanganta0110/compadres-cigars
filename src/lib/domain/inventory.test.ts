import { describe, expect, it } from "vitest";
import { slugify, stockAlerts, stockState } from "./inventory";
import { dailySeries, summarizeSales, topProducts, type SalesLine, type SalesOrder } from "./sales";
import { calculateTax, formatBps, parsePercentToBps, ADMIN_OVERRIDE, type TaxRateRow } from "./tax";

const now = new Date("2026-10-08T18:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

describe("stock alerts", () => {
  it("out at zero, low at or below the threshold, ok above", () => {
    expect(stockState(0, 5)).toBe("out");
    expect(stockState(5, 5)).toBe("low");
    expect(stockState(6, 5)).toBe("ok");
    expect(stockState(-1, 5)).toBe("out");
  });
  it("lists only published products that need restocking, emptiest first", () => {
    const r = (id: string, stock: number, active = true, t = 5) => ({ id, name: id, sku: id, stock, low_stock_threshold: t, active });
    expect(stockAlerts([r("a", 3), r("b", 0), r("c", 50), r("d", 0, false), r("e", 10, true, 10)]).map((x) => `${x.id}:${x.state}`)).toEqual(["b:out", "a:low", "e:low"]);
  });
  it("slugifies names safely", () => {
    expect(slugify('Sugarhill "Rapper\'s Delight" — Box of 10')).toBe("sugarhill-rapper-s-delight-box-of-10");
    expect(slugify("  Café Ñandú!! ")).toBe("cafe-nandu");
    expect(slugify("../../etc")).toBe("etc");
  });
});

describe("sales dashboard", () => {
  const o = (status: string, hours: number, cents = 10000): SalesOrder => ({ status, created_at: ago(hours), paid_at: status === "pending" ? null : ago(hours), total_cents: cents });
  it("counts paid statuses only, in today / 7 / 30 day windows, with an average order value", () => {
    const orders = [o("processing", 1), o("packed", 30), o("completed", 24 * 20), o("refunded", 24 * 3), o("pending", 1), o("cancelled", 2), o("processing", 24 * 40)];
    const s = summarizeSales(orders, now);
    expect(s.today.orders).toBe(1);
    expect(s.days7).toEqual({ orders: 3, cents: 30000 });
    expect(s.days30).toEqual({ orders: 4, cents: 40000 });
    expect(s.avgOrderCents).toBe(10000);
    expect(summarizeSales([], now).avgOrderCents).toBe(0);
  });
  it("builds a zero-filled daily series, oldest first", () => {
    const series = dailySeries([o("processing", 1, 500), o("processing", 2, 700), o("pending", 1, 999)], now, 7);
    expect(series).toHaveLength(7);
    expect(series[6]).toEqual({ day: "2026-10-08", orders: 2, cents: 1200 });
    expect(series[0].cents).toBe(0);
    expect(series.map((d) => d.day)).toEqual([...series.map((d) => d.day)].sort());
  });
  it("ranks best sellers by units from paid orders in the window only", () => {
    const line = (sku: string, q: number, p: number, status: string, h: number): SalesLine => ({ name: sku, sku, quantity: q, unit_price_cents: p, order: { status, created_at: ago(h), paid_at: ago(h) } });
    const top = topProducts([line("A", 2, 100, "processing", 5), line("A", 1, 100, "completed", 50), line("B", 3, 50, "packed", 5), line("C", 99, 1, "pending", 5), line("D", 99, 1, "processing", 24 * 60)], now);
    expect(top.map((t) => [t.sku, t.units, t.cents])).toEqual([["A", 3, 300], ["B", 3, 150]]);
  });
});

describe("editable tax rates", () => {
  it("parses percentages strictly into basis points", () => {
    expect(parsePercentToBps("8.44")).toBe(844);
    expect(parsePercentToBps("0")).toBe(0);
    expect(parsePercentToBps("10")).toBe(1000);
    expect(parsePercentToBps("30")).toBe(3000);
    expect(parsePercentToBps("7.5%")).toBe(750);
    for (const bad of ["", "-1", "30.01", "31", "1e2", "8.444", "abc", "8,44", "100"]) expect(parsePercentToBps(bad)).toBeNull();
    expect(formatBps(844)).toBe("8.44");
  });
  const rates = new Map<string, TaxRateRow>([["MO", { rate_bps: 1000, source_sha256: ADMIN_OVERRIDE, effective_date: "2026-10-08" }], ["TX", { rate_bps: 820, source_sha256: "abc", effective_date: "2026-08-19" }]]);
  it("uses the live table when given: an edited rate drives tax and is marked as an admin override", () => {
    const r = calculateTax("MO", 14900, rates);
    expect(r.ok && r.snapshot).toMatchObject({ rate_bps: 1000, tax_cents: 1490, basis: "admin_override", is_average_reference: false, source_sha256: ADMIN_OVERRIDE });
    const t = calculateTax("TX", 10000, rates);
    expect(t.ok && t.snapshot).toMatchObject({ rate_bps: 820, basis: "avg_combined_reference" });
  });
  it("a state missing from the live table, or a corrupt rate, fails closed", () => {
    expect(calculateTax("CA", 100, rates).ok).toBe(false);
    expect(calculateTax("MO", 100, new Map([["MO", { rate_bps: 5000, source_sha256: "x", effective_date: "d" }]])).ok).toBe(false);
    expect(calculateTax("MO", 100, new Map([["MO", { rate_bps: -1, source_sha256: "x", effective_date: "d" }]])).ok).toBe(false);
  });
});
