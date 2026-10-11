import { isPaid } from "./operations";

export type ReportOrder = { status: string; created_at: string; tax_cents: number; subtotal_cents: number; shipping_cents: number; total_cents: number; state: string | null; /** boxes (units) on the order */ units?: number };
export type ReportRefund = { amount_cents: number; created_at: string; state: string | null };
export type StateRow = { state: string; orders: number; units: number; taxable_cents: number; tax_estimated_cents: number; refunds_cents: number };

export const TAX_REPORT_DISCLAIMER =
  "Tax amounts are estimates based on state-level average combined rates. They need tax-professional review and are not final filed liability.";

/**
 * Finalized sales = ALL paid statuses (processing, packed, completed, refunded). Pending/cancelled never count.
 * Refunds belong to the period in which they were created, so later refunds never rewrite an earlier period.
 */
export function buildTaxReport(orders: ReportOrder[], refunds: ReportRefund[], from: Date, to: Date) {
  const inRange = (iso: string) => { const t = new Date(iso).getTime(); return t >= from.getTime() && t < to.getTime(); };
  const rows = new Map<string, StateRow>();
  const row = (s: string | null) => {
    const k = s ?? "??";
    if (!rows.has(k)) rows.set(k, { state: k, orders: 0, units: 0, taxable_cents: 0, tax_estimated_cents: 0, refunds_cents: 0 });
    return rows.get(k)!;
  };
  for (const o of orders) if (isPaid(o.status) && inRange(o.created_at)) {
    const r = row(o.state); r.orders++; r.units += o.units ?? 0; r.taxable_cents += o.subtotal_cents; r.tax_estimated_cents += o.tax_cents;
  }
  for (const f of refunds) if (inRange(f.created_at)) row(f.state).refunds_cents += f.amount_cents;
  const list = [...rows.values()].sort((a, b) => a.state.localeCompare(b.state));
  const sum = (k: keyof Omit<StateRow, "state">) => list.reduce((n, r) => n + r[k], 0);
  return { rows: list, totals: { orders: sum("orders"), units: sum("units"), taxable_cents: sum("taxable_cents"), tax_estimated_cents: sum("tax_estimated_cents"), refunds_cents: sum("refunds_cents") }, disclaimer: TAX_REPORT_DISCLAIMER };
}
