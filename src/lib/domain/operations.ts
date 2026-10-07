/**
 * Fulfillment and sales classification. LESSON FROM THE WP BUILD: statuses added later (packed) must count
 * everywhere "processing" counts as a finalized sale. Keep ONE definition of "paid" and reuse it everywhere.
 */
export const PAID_STATUSES = ["processing", "packed", "completed", "refunded"] as const;
export type OrderStatus = "pending" | (typeof PAID_STATUSES)[number] | "cancelled";
export const isPaid = (s: string): boolean => (PAID_STATUSES as readonly string[]).includes(s);

export type OpsOrder = {
  id: string; number: number; status: OrderStatus; created_at: string; paid_at: string | null; packed_at: string | null;
  tracking_number: string | null; carrier_status_code: string | null; carrier_status_checked_at: string | null;
};

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const paidAt = (o: OpsOrder) => new Date(o.paid_at ?? o.created_at).getTime();

export type OpsSummary = {
  received: { today: number; days7: number; days30: number };
  notPacked: number; packedNeedsLabel: number; shipped: number; delivered30: number; unpackedOver24h: number;
};

export function summarizeOps(orders: OpsOrder[], now: Date): OpsSummary {
  const t = now.getTime();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const paid = orders.filter((o) => isPaid(o.status));
  const s: OpsSummary = { received: { today: 0, days7: 0, days30: 0 }, notPacked: 0, packedNeedsLabel: 0, shipped: 0, delivered30: 0, unpackedOver24h: 0 };
  for (const o of paid) {
    const at = paidAt(o);
    if (at >= startOfToday.getTime()) s.received.today++;
    if (at >= t - 7 * DAY) s.received.days7++;
    if (at >= t - 30 * DAY) s.received.days30++;
    if (o.status === "processing") { s.notPacked++; if (t - at > DAY) s.unpackedOver24h++; }
    const delivered = o.carrier_status_code === "DL";
    if (o.status === "packed" && !o.tracking_number) s.packedNeedsLabel++;
    if (o.tracking_number && !delivered && (o.status === "packed" || o.status === "completed")) s.shipped++;
    if (delivered && o.carrier_status_checked_at && new Date(o.carrier_status_checked_at).getTime() >= t - 30 * DAY) s.delivered30++;
  }
  return s;
}

/** Orders to pack, oldest first, flagged late after 24 hours. */
export function packQueue(orders: OpsOrder[], now: Date) {
  return orders.filter((o) => o.status === "processing")
    .sort((a, b) => paidAt(a) - paidAt(b))
    .map((o) => ({ ...o, waitingMs: now.getTime() - paidAt(o), late: now.getTime() - paidAt(o) > DAY }));
}

export function formatWaiting(ms: number): string {
  const h = Math.floor(ms / HOUR);
  if (h < 1) return `${Math.max(0, Math.floor(ms / 60_000))} min`;
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

/** Staff-entered tracking numbers: 6-34 alphanumeric. */
export const isTrackingNumber = (v: string): boolean => /^[A-Za-z0-9]{6,34}$/.test(v);
export const fedexTrackUrl = (n: string): string => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`;
