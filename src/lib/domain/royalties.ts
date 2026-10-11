import { isPaid } from "./operations";

/**
 * Royalty = rate x NET product sales of a brand, where net sales are the brand's item subtotal on paid orders
 * (no tax, no shipping) reduced in proportion to refunds on that order. The rate used is the one in effect when the
 * order was PAID, so changing a rate only affects later sales (unless the admin sets an earlier effective date).
 */
export type RateRow = { brand_id: string; rate_bps: number; effective_from: string };
export type RoyaltyItem = {
  brandId: string | null; quantity: number; unitPriceCents: number;
  order: { id: string; status: string; created_at: string; paid_at: string | null; total_cents: number; refundedCents: number };
};
export type BrandRoyalty = { brandId: string; units: number; grossCents: number; netCents: number; royaltyCents: number };

const paidTime = (o: { created_at: string; paid_at: string | null }) => new Date(o.paid_at ?? o.created_at).getTime();

/** Rate in effect for a brand at a moment: the latest row not after it, else 0. */
export function rateAt(rates: RateRow[], brandId: string, at: Date): number {
  let best: RateRow | null = null;
  for (const r of rates) {
    if (r.brand_id !== brandId) continue;
    const t = new Date(r.effective_from).getTime();
    if (t <= at.getTime() && (!best || t >= new Date(best.effective_from).getTime())) best = r;
  }
  return best?.rate_bps ?? 0;
}
export const currentRate = (rates: RateRow[], brandId: string, now: Date) => rateAt(rates, brandId, now);

/** Per-brand totals for orders paid in [from, to). Items without a brand (a product that was deleted) are not attributed. */
export function computeRoyalties(items: RoyaltyItem[], rates: RateRow[], from: Date | null, to: Date | null): Map<string, BrandRoyalty> {
  // group by order and brand so rounding happens once per order, as it would on a statement
  const groups = new Map<string, { brandId: string; units: number; gross: number; order: RoyaltyItem["order"] }>();
  for (const it of items) {
    if (!it.brandId || !isPaid(it.order.status)) continue;
    const when = paidTime(it.order);
    if ((from && when < from.getTime()) || (to && when >= to.getTime())) continue;
    const key = `${it.order.id}|${it.brandId}`;
    const g = groups.get(key) ?? { brandId: it.brandId, units: 0, gross: 0, order: it.order };
    g.units += it.quantity; g.gross += it.quantity * it.unitPriceCents; groups.set(key, g);
  }
  const out = new Map<string, BrandRoyalty>();
  for (const g of groups.values()) {
    const total = g.order.total_cents;
    const keep = total > 0 ? Math.max(0, Math.min(1, (total - g.order.refundedCents) / total)) : 1;
    const net = Math.round(g.gross * keep);
    const bps = rateAt(rates, g.brandId, new Date(paidTime(g.order)));
    const row = out.get(g.brandId) ?? { brandId: g.brandId, units: 0, grossCents: 0, netCents: 0, royaltyCents: 0 };
    row.units += g.units; row.grossCents += g.gross; row.netCents += net; row.royaltyCents += Math.round((net * bps) / 10000);
    out.set(g.brandId, row);
  }
  return out;
}

/** "10", "7.5" or "12.25" -> basis points; 0 to 100 percent, at most 2 decimals. */
export function parseRoyaltyPercent(input: string): number | null {
  const t = input.trim().replace(/%$/, "");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const [w, f = ""] = t.split(".");
  const bps = Number(w) * 100 + Number(f.padEnd(2, "0"));
  return bps <= 10000 ? bps : null;
}

/** Payout: positive dollars with at most 2 decimals, never more than what is still owed. */
export function checkPayout(amountCents: number | null, owedCents: number): { ok: true } | { ok: false; code: "invalid_amount" | "exceeds_balance" } {
  if (amountCents === null || !Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, code: "invalid_amount" };
  if (amountCents > owedCents) return { ok: false, code: "exceeds_balance" };
  return { ok: true };
}
