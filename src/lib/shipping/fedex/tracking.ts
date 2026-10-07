export type TrackingStatus = { code: string; text: string };
export const NOT_FOUND = "NOTFOUND";
export const isDelivered = (s: TrackingStatus) => s.code === "DL";
/** DE = delivery exception, SE = shipment exception. */
export const needsAttention = (s: TrackingStatus) => s.code === "DE" || s.code === "SE";

const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n) : "");

/** Throws on anything unexpected; a tracking failure must never change an order. */
export function parseTrackingResponse(body: unknown): TrackingStatus {
  const b = body as { output?: { completeTrackResults?: { trackResults?: Record<string, unknown>[] }[] } } | null;
  const result = b?.output?.completeTrackResults?.[0]?.trackResults?.[0];
  if (!result || typeof result !== "object") throw new Error("FedEx tracking is unavailable.");
  const err = (result.error as { code?: unknown } | undefined)?.code;
  if (typeof err === "string" && err.includes("NOTFOUND")) return { code: NOT_FOUND, text: "Not yet in the FedEx system" };
  const d = result.latestStatusDetail as { code?: unknown; statusByLocale?: unknown; description?: unknown } | undefined;
  if (!d || typeof d !== "object") throw new Error("FedEx tracking is unavailable.");
  const code = clean(d.code, 8), text = clean(d.statusByLocale ?? d.description, 80);
  if (!code || !text) throw new Error("FedEx tracking is unavailable.");
  return { code: code.toUpperCase(), text };
}
