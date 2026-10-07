import "server-only";
import { FedExClient, fetchTransport } from "@/lib/shipping/fedex/client";
import { fedexConfigFromEnv, isConfigured } from "@/lib/shipping/fedex/config";
import { serviceClient } from "./db";
import { auditAdmin } from "./staff";

const BATCH = 40;
const LOOKBACK_DAYS = 60;

export function fedexClientFromEnv(): FedExClient | null {
  if (process.env.COMPADRES_SHIPPING_PROVIDER !== "fedex") return null;
  const cfg = fedexConfigFromEnv(process.env);
  return isConfigured(cfg) ? new FedExClient(cfg, fetchTransport) : null;
}

/**
 * Read-only carrier status refresh. Writes ONLY the carrier_status_* columns; it never changes an order's status
 * and a FedEx failure (including the sandbox Track API 403) leaves everything untouched.
 */
export async function refreshTracking(opts: { orderId?: string } = {}): Promise<{ checked: number; updated: number; skipped?: string }> {
  const client = fedexClientFromEnv();
  if (!client) return { checked: 0, updated: 0, skipped: "fedex not configured" };
  const db = serviceClient();
  let q = db.from("orders").select("id, number, tracking_number, carrier_status_code, carrier_status_text")
    .in("status", ["processing", "packed", "completed"]).not("tracking_number", "is", null);
  if (opts.orderId) q = q.eq("id", opts.orderId);
  else q = q.gte("created_at", new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString()).or("carrier_status_code.is.null,carrier_status_code.neq.DL").order("created_at").limit(BATCH);
  const { data, error } = await q;
  if (error) throw error;
  let updated = 0;
  for (const o of data ?? []) {
    try {
      const s = await client.track(o.tracking_number as string);
      await db.from("orders").update({ carrier_status_code: s.code, carrier_status_text: s.text, carrier_status_checked_at: new Date().toISOString() }).eq("id", o.id);
      if (s.text !== o.carrier_status_text) { updated++; await auditAdmin("system", "tracking.status_changed", "orders", o.id, { number: o.number, code: s.code }); }
    } catch { /* unavailable: leave the order as is */ }
  }
  return { checked: (data ?? []).length, updated };
}
