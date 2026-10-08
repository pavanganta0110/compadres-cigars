import { isPaid } from "./operations";

export type SalesOrder = { status: string; created_at: string; paid_at: string | null; total_cents: number };
export type SalesLine = { name: string; sku: string; quantity: number; unit_price_cents: number; order: { status: string; created_at: string; paid_at: string | null } };

const DAY = 86_400_000;
const at = (o: { created_at: string; paid_at: string | null }) => new Date(o.paid_at ?? o.created_at).getTime();
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export type SalesSummary = {
  today: { orders: number; cents: number }; days7: { orders: number; cents: number }; days30: { orders: number; cents: number };
  avgOrderCents: number;
};

/** Gross sales over PAID orders only (the single definition in operations.ts). Pending and cancelled never count. */
export function summarizeSales(orders: SalesOrder[], now: Date): SalesSummary {
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const t = now.getTime();
  const s: SalesSummary = { today: { orders: 0, cents: 0 }, days7: { orders: 0, cents: 0 }, days30: { orders: 0, cents: 0 }, avgOrderCents: 0 };
  for (const o of orders.filter((x) => isPaid(x.status))) {
    const when = at(o);
    if (when >= startOfToday.getTime()) { s.today.orders++; s.today.cents += o.total_cents; }
    if (when >= t - 7 * DAY) { s.days7.orders++; s.days7.cents += o.total_cents; }
    if (when >= t - 30 * DAY) { s.days30.orders++; s.days30.cents += o.total_cents; }
  }
  s.avgOrderCents = s.days30.orders ? Math.round(s.days30.cents / s.days30.orders) : 0;
  return s;
}

/** One entry per day for the last `days` days (oldest first), zero-filled so the chart has no gaps. */
export function dailySeries(orders: SalesOrder[], now: Date, days = 14): { day: string; orders: number; cents: number }[] {
  const out = new Map<string, { day: string; orders: number; cents: number }>();
  for (let i = days - 1; i >= 0; i--) { const k = dayKey(now.getTime() - i * DAY); out.set(k, { day: k, orders: 0, cents: 0 }); }
  for (const o of orders.filter((x) => isPaid(x.status))) {
    const row = out.get(dayKey(at(o)));
    if (row) { row.orders++; row.cents += o.total_cents; }
  }
  return [...out.values()];
}

export type TopProduct = { sku: string; name: string; units: number; cents: number };
/** Best sellers by units (revenue breaks ties) among paid orders in the last `days` days. */
export function topProducts(lines: SalesLine[], now: Date, days = 30, limit = 5): TopProduct[] {
  const since = now.getTime() - days * DAY;
  const by = new Map<string, TopProduct>();
  for (const l of lines) {
    if (!isPaid(l.order.status) || at(l.order) < since) continue;
    const x = by.get(l.sku) ?? { sku: l.sku, name: l.name, units: 0, cents: 0 };
    x.units += l.quantity; x.cents += l.quantity * l.unit_price_cents; by.set(l.sku, x);
  }
  return [...by.values()].sort((a, b) => b.units - a.units || b.cents - a.cents || a.name.localeCompare(b.name)).slice(0, limit);
}
