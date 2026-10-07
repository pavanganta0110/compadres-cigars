import { describe, expect, it } from "vitest";
import { fedexTrackUrl, formatWaiting, isPaid, isTrackingNumber, packQueue, summarizeOps, type OpsOrder } from "./operations";
import { neutralizeCell, toCsv } from "./csv";
import { buildTaxReport } from "./taxReport";
import { can } from "./permissions";

const now = new Date("2026-10-07T18:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
const o = (n: number, status: OpsOrder["status"], hoursAgo: number, extra: Partial<OpsOrder> = {}): OpsOrder => ({
  id: String(n), number: n, status, created_at: ago(hoursAgo), paid_at: ago(hoursAgo), packed_at: null, tracking_number: null, carrier_status_code: null, carrier_status_checked_at: null, ...extra,
});

describe("paid statuses (packed must count as a finalized sale)", () => {
  it("includes processing, packed, completed, refunded; excludes pending and cancelled", () => {
    for (const s of ["processing", "packed", "completed", "refunded"]) expect(isPaid(s)).toBe(true);
    for (const s of ["pending", "cancelled", "junk"]) expect(isPaid(s)).toBe(false);
  });
});

describe("operations summary", () => {
  const orders = [
    o(1, "pending", 1), o(2, "processing", 2), o(3, "processing", 30), o(4, "packed", 5),
    o(5, "packed", 8, { tracking_number: "123456789012", carrier_status_code: "IT" }),
    o(6, "completed", 100, { tracking_number: "123456789013", carrier_status_code: "DL", carrier_status_checked_at: ago(10) }),
    o(7, "cancelled", 1), o(8, "refunded", 24 * 40),
  ];
  const s = summarizeOps(orders, now);
  it("counts only paid orders as received", () => expect(s.received).toEqual({ today: expect.any(Number), days7: 5, days30: 5 }));
  it("buckets fulfillment", () => {
    expect(s.notPacked).toBe(2);
    expect(s.unpackedOver24h).toBe(1);
    expect(s.packedNeedsLabel).toBe(1);
    expect(s.shipped).toBe(1);
    expect(s.delivered30).toBe(1);
  });
  it("pack queue is oldest first with late flags", () => {
    const q = packQueue(orders, now);
    expect(q.map((x) => x.number)).toEqual([3, 2]);
    expect(q.map((x) => x.late)).toEqual([true, false]);
  });
  it("formats waiting time", () => {
    expect(formatWaiting(5 * 60_000)).toBe("5 min");
    expect(formatWaiting(30 * 3600_000)).toBe("30 h");
    expect(formatWaiting(72 * 3600_000)).toBe("3 d");
  });
});

describe("tracking numbers", () => {
  it("accepts 6-34 alphanumerics only", () => {
    expect(isTrackingNumber("123456")).toBe(true);
    expect(isTrackingNumber("12345")).toBe(false);
    expect(isTrackingNumber("1234 5678")).toBe(false);
    expect(isTrackingNumber("a".repeat(35))).toBe(false);
    expect(isTrackingNumber("123456; drop")).toBe(false);
    expect(fedexTrackUrl("12345678")).toBe("https://www.fedex.com/fedextrack/?trknbr=12345678");
  });
});

describe("csv formula injection", () => {
  it("neutralizes formulas, including after whitespace and control characters", () => {
    for (const bad of ["=1+1", "+cmd", "-2", "@SUM(A1)", "  =HYPERLINK(\"x\")", "\t=1", "\r=1"]) expect(neutralizeCell(bad).startsWith("'")).toBe(true);
    expect(neutralizeCell("MO")).toBe("MO");
    expect(neutralizeCell("a\u0000b")).toBe("ab");
  });
  it("quotes and escapes", () => expect(toCsv([["a\"b", "=x"]])).toBe('"a""b","\'=x"\r\n'));
});

describe("tax report", () => {
  const from = new Date("2026-10-01T00:00:00Z"), to = new Date("2026-11-01T00:00:00Z");
  const ord = (status: string, state: string, tax: number, at = "2026-10-05T00:00:00Z") => ({ status, created_at: at, tax_cents: tax, subtotal_cents: 10000, shipping_cents: 1000, total_cents: 11000 + tax, state });
  it("counts every paid status including packed, never pending or cancelled", () => {
    const r = buildTaxReport([ord("processing", "MO", 844), ord("packed", "MO", 844), ord("completed", "TX", 820), ord("refunded", "TX", 820), ord("pending", "MO", 844), ord("cancelled", "TX", 820)], [], from, to);
    expect(r.totals).toMatchObject({ orders: 4, tax_estimated_cents: 3328, taxable_cents: 40000 });
    expect(r.rows.map((x) => [x.state, x.orders])).toEqual([["MO", 2], ["TX", 2]]);
  });
  it("attributes refunds to the period they were created, even for older orders", () => {
    const refunds = [{ amount_cents: 5000, created_at: "2026-10-10T00:00:00Z", state: "MO" }, { amount_cents: 999, created_at: "2026-09-10T00:00:00Z", state: "MO" }];
    expect(buildTaxReport([], refunds, from, to).totals.refunds_cents).toBe(5000);
  });
  it("excludes orders outside the period and labels amounts as estimates", () => {
    const r = buildTaxReport([ord("completed", "MO", 844, "2026-09-30T23:59:59Z"), ord("completed", "MO", 844, "2026-11-01T00:00:00Z")], [], from, to);
    expect(r.totals.orders).toBe(0);
    expect(r.disclaimer).toMatch(/estimates/);
  });
});

describe("permissions", () => {
  it("restrictions and users are owner-only; fulfillment cannot see reports", () => {
    expect(can("owner", "manage_restrictions")).toBe(true);
    expect(can("manager", "manage_restrictions")).toBe(false);
    expect(can("manager", "manage_users")).toBe(false);
    expect(can("fulfillment", "view_reports")).toBe(false);
    expect(can("fulfillment", "fulfill")).toBe(true);
    expect(can("viewer", "fulfill")).toBe(false);
  });
  it("unknown roles and prototype keys get nothing", () => {
    for (const r of [undefined, null, "", "admin", "__proto__", "constructor"]) expect(can(r as never, "view")).toBe(false);
  });
});
