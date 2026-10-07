import "server-only";
import { buildTaxReport, type ReportOrder, type ReportRefund } from "@/lib/domain/taxReport";
import { serviceClient } from "./db";

export function parsePeriod(from?: string, to?: string) {
  const d = (s: string | undefined, fallback: Date) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? new Date(`${s}T00:00:00Z`) : fallback);
  const now = new Date();
  const start = d(from, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const endIncl = d(to, now);
  return { from: start, to: new Date(Date.UTC(endIncl.getUTCFullYear(), endIncl.getUTCMonth(), endIncl.getUTCDate() + 1)) };
}

export async function taxReportFor(from: Date, to: Date) {
  const db = serviceClient();
  const [o, r] = await Promise.all([
    db.from("orders").select("status, created_at, tax_cents, subtotal_cents, shipping_cents, total_cents, shipping_address").gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).limit(5000),
    db.from("refunds").select("amount_cents, created_at, orders(shipping_address)").gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).limit(5000),
  ]);
  if (o.error) throw o.error;
  if (r.error) throw r.error;
  const orders: ReportOrder[] = (o.data ?? []).map((x) => ({ ...x, state: (x.shipping_address as { state?: string } | null)?.state ?? null }));
  const refunds: ReportRefund[] = (r.data ?? []).map((x) => ({ amount_cents: x.amount_cents, created_at: x.created_at, state: ((x.orders as unknown as { shipping_address: { state?: string } | null } | null)?.shipping_address?.state) ?? null }));
  return buildTaxReport(orders, refunds, from, to);
}
