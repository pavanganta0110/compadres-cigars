export type FedExRate = { service: string; label: string; cents: number; currency: string; adultSignature: true; reference: string };

const ident = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[^A-Za-z0-9._:-]/g, "").slice(0, n) : "");
const label = (v: unknown, fallback: string) => {
  const s = typeof v === "string" ? v.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 80) : "";
  return s || fallback.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

/** Keeps ONLY rates that support Adult Signature (signatureOptionType === ADULT) and carry an ACCOUNT charge. */
export function normalizeRates(body: unknown): FedExRate[] {
  const b = body as { transactionId?: unknown; output?: { rateReplyDetails?: unknown } } | null;
  const transaction = ident(b?.transactionId, 64);
  const details = b?.output?.rateReplyDetails;
  if (!transaction || !Array.isArray(details)) return [];
  const out: FedExRate[] = [];
  for (const d of details as Record<string, unknown>[]) {
    if (!d || typeof d !== "object" || d.signatureOptionType !== "ADULT") continue;
    const service = ident(d.serviceType, 64).toLowerCase();
    const charge = accountCharge(d.ratedShipmentDetails);
    if (!service || !charge) continue;
    out.push({ service, label: label(d.serviceName, service), cents: charge.cents, currency: charge.currency, adultSignature: true, reference: `${transaction}:${service}` });
  }
  return out;
}

function accountCharge(details: unknown): { cents: number; currency: string } | null {
  if (!Array.isArray(details)) return null;
  for (const d of details as Record<string, unknown>[]) {
    if (!d || d.rateType !== "ACCOUNT") continue;
    const amount = d.totalNetCharge;
    const currency = String((d.shipmentRateDetail as { currency?: unknown } | undefined)?.currency ?? "").toUpperCase();
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) continue;
    return { cents: Math.round(amount * 100), currency };
  }
  return null;
}
