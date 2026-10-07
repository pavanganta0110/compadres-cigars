import "server-only";
import { serviceClient } from "./db";
import type { OpsOrder } from "@/lib/domain/operations";

export type OrderRow = OpsOrder & {
  email: string; total_cents: number; tax_cents: number; subtotal_cents: number; shipping_cents: number;
  state: string | null; item_count: number;
};

const COLS = "id, number, status, created_at, paid_at, packed_at, tracking_number, carrier_status_code, carrier_status_checked_at, email, total_cents, tax_cents, subtotal_cents, shipping_cents, shipping_address, order_items(quantity)";

type Raw = Omit<OrderRow, "state" | "item_count"> & { shipping_address: { state?: string } | null; order_items: { quantity: number }[] };
const shape = (r: Raw): OrderRow => ({ ...r, state: r.shipping_address?.state ?? null, item_count: (r.order_items ?? []).reduce((n, i) => n + i.quantity, 0) });

export async function loadOrders(opts: { sinceDays?: number; limit?: number } = {}): Promise<OrderRow[]> {
  let q = serviceClient().from("orders").select(COLS).order("created_at", { ascending: false }).limit(opts.limit ?? 500);
  if (opts.sinceDays) q = q.gte("created_at", new Date(Date.now() - opts.sinceDays * 86400_000).toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as Raw[]).map(shape);
}
