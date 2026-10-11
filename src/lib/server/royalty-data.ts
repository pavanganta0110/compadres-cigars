import "server-only";
import { PAID_STATUSES } from "@/lib/domain/operations";
import { computeRoyalties, currentRate, type BrandRoyalty, type RateRow, type RoyaltyItem } from "@/lib/domain/royalties";
import { serviceClient } from "./db";

export type BrandRoyaltyRow = {
  brandId: string; name: string; slug: string; active: boolean;
  rateBps: number;                       // rate in effect now
  period: BrandRoyalty;                  // sales/royalty for the chosen period
  earnedAllTime: number; paidOut: number; owed: number;
};
export type Payout = { id: string; brand_id: string; amount_cents: number; paid_on: string; reference: string | null; created_at: string };

type RawItem = {
  quantity: number; unit_price_cents: number;
  products: { brand_id: string | null } | null;
  orders: { id: string; status: string; created_at: string; paid_at: string | null; total_cents: number; refunds: { amount_cents: number; status: string }[] };
};

/** Everything the royalty screens need, computed from paid orders (the single PAID_STATUSES definition), refunds, rate history and payouts. */
export async function loadRoyalties(from: Date | null, to: Date | null, now = new Date()) {
  const db = serviceClient();
  const [brands, rates, payouts, items] = await Promise.all([
    db.from("brands").select("id, name, slug, active").order("display_order"),
    db.from("brand_royalty_rates").select("brand_id, rate_bps, effective_from"),
    db.from("royalty_payouts").select("id, brand_id, amount_cents, paid_on, reference, created_at").order("paid_on", { ascending: false }).limit(500),
    db.from("order_items").select("quantity, unit_price_cents, products(brand_id), orders!inner(id, status, created_at, paid_at, total_cents, refunds(amount_cents, status))").in("orders.status", [...PAID_STATUSES]).limit(50000),
  ]);
  if (brands.error || rates.error || payouts.error || items.error) throw new Error("royalty data unavailable");
  const rateRows = (rates.data ?? []) as RateRow[];
  const royaltyItems: RoyaltyItem[] = ((items.data ?? []) as unknown as RawItem[]).map((r) => ({
    brandId: r.products?.brand_id ?? null, quantity: r.quantity, unitPriceCents: r.unit_price_cents,
    order: { id: r.orders.id, status: r.orders.status, created_at: r.orders.created_at, paid_at: r.orders.paid_at, total_cents: r.orders.total_cents, refundedCents: r.orders.refunds.filter((x) => x.status === "completed").reduce((n, x) => n + x.amount_cents, 0) },
  }));
  const period = computeRoyalties(royaltyItems, rateRows, from, to);
  const allTime = computeRoyalties(royaltyItems, rateRows, null, null);
  const paid = new Map<string, number>();
  for (const p of payouts.data ?? []) paid.set(p.brand_id as string, (paid.get(p.brand_id as string) ?? 0) + (p.amount_cents as number));
  const rows: BrandRoyaltyRow[] = (brands.data ?? []).map((b) => {
    const earned = allTime.get(b.id as string)?.royaltyCents ?? 0;
    const out = paid.get(b.id as string) ?? 0;
    return {
      brandId: b.id as string, name: b.name as string, slug: b.slug as string, active: b.active as boolean, rateBps: currentRate(rateRows, b.id as string, now),
      period: period.get(b.id as string) ?? { brandId: b.id as string, units: 0, grossCents: 0, netCents: 0, royaltyCents: 0 },
      earnedAllTime: earned, paidOut: out, owed: Math.max(0, earned - out),
    };
  });
  return { rows, payouts: (payouts.data ?? []) as Payout[], rates: rateRows };
}

/** This month's window (server local time is fine for a dashboard). */
export function monthWindow(now = new Date()): { from: Date; to: Date } {
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}
