import { fedexConfigFromEnv, isConfigured, type FedExConfig } from "./config";
import type { Transport } from "./client";

export type Diagnosis = { ok: boolean; step: "config" | "authorization" | "rates" | "done"; summary: string; fedexCode?: string };

/** Names of settings that are missing or malformed. Never returns values. */
export function configProblems(c: FedExConfig): string[] {
  const p: string[] = [];
  const production = c.appEnv === "production";
  if (production && !c.productionApproved) p.push("COMPADRES_SHIPPING_PRODUCTION_APPROVED is not true (required in production)");
  if (c.apiBaseUrl !== (production ? "https://apis.fedex.com" : "https://apis-sandbox.fedex.com")) p.push(`COMPADRES_FEDEX_API_BASE_URL must be ${production ? "https://apis.fedex.com" : "https://apis-sandbox.fedex.com"}`);
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(c.clientId)) p.push("COMPADRES_FEDEX_CLIENT_ID is missing or has invalid characters");
  if (!c.clientSecret) p.push("COMPADRES_FEDEX_CLIENT_SECRET is missing");
  if (!/^[0-9]{9}$/.test(c.accountNumber)) p.push("COMPADRES_FEDEX_ACCOUNT_NUMBER must be 9 digits");
  if (!/^[A-Z]{2}$/.test(c.originCountry)) p.push("COMPADRES_FEDEX_ORIGIN_COUNTRY must be 2 letters");
  if (!/^[A-Z0-9]{1,3}$/.test(c.originState)) p.push("COMPADRES_FEDEX_ORIGIN_STATE is missing");
  if (!/^[A-Z0-9 -]{3,10}$/.test(c.originPostalCode)) p.push("COMPADRES_FEDEX_ORIGIN_POSTAL_CODE is missing");
  return p;
}

/** Runs one real authorization and one small rate quote, and reports which step failed and FedEx's error CODE only. */
export async function diagnoseFedEx(env: Record<string, string | undefined>, transport: Transport): Promise<Diagnosis> {
  if (env.COMPADRES_SHIPPING_PROVIDER !== "fedex") return { ok: false, step: "config", summary: "COMPADRES_SHIPPING_PROVIDER is not set to fedex, so the site uses mock rates." };
  const cfg = fedexConfigFromEnv(env);
  if (!isConfigured(cfg)) return { ok: false, step: "config", summary: `Not configured: ${configProblems(cfg).join("; ") || "unknown"}` };
  const auth = await transport(`${cfg.apiBaseUrl}/oauth/token`, {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.clientId, client_secret: cfg.clientSecret }).toString(),
  });
  if (auth.status !== 200) return { ok: false, step: "authorization", summary: `FedEx rejected the API key and secret (HTTP ${auth.status}). Check the key and secret come from the same FedEx project and the key has no extra spaces.`, fedexCode: codeOf(auth.text) };
  let token = "";
  try { token = String(JSON.parse(auth.text).access_token ?? ""); } catch { /* handled below */ }
  if (!token) return { ok: false, step: "authorization", summary: "FedEx returned no access token." };
  const rate = await transport(`${cfg.apiBaseUrl}/rate/v1/rates/quotes`, {
    method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-locale": "en_US" },
    body: JSON.stringify({
      accountNumber: { value: cfg.accountNumber }, carrierCodes: ["FDXE", "FDXG"],
      requestedShipment: {
        pickupType: "USE_SCHEDULED_PICKUP", rateRequestType: ["ACCOUNT"],
        shipper: { address: { countryCode: cfg.originCountry, stateOrProvinceCode: cfg.originState, postalCode: cfg.originPostalCode } },
        recipient: { address: { countryCode: "US", stateOrProvinceCode: "KS", postalCode: "66101", residential: true } },
        packagingType: "YOUR_PACKAGING",
        requestedPackageLineItems: [{ groupPackageCount: 1, weight: { units: "LB", value: 3 }, packageSpecialServices: { specialServiceTypes: ["SIGNATURE_OPTION"], signatureOptionType: "ADULT" } }],
      },
    }),
  });
  if (rate.status !== 200) {
    const code = codeOf(rate.text);
    const hint = code === "ACCOUNT.NUMBER.MISMATCH" ? " The account number does not belong to this API key's FedEx project." : "";
    return { ok: false, step: "rates", summary: `FedEx accepted the key but refused the rate request (HTTP ${rate.status}).${hint}`, fedexCode: code };
  }
  let adult = 0;
  try { adult = (JSON.parse(rate.text).output?.rateReplyDetails ?? []).filter((d: { signatureOptionType?: string }) => d.signatureOptionType === "ADULT").length; } catch { /* count stays 0 */ }
  return adult > 0 ? { ok: true, step: "done", summary: `Working: FedEx returned ${adult} adult-signature rate(s).` }
    : { ok: false, step: "rates", summary: "FedEx answered, but none of the rates support adult signature." };
}

const codeOf = (text: string): string | undefined => {
  try { const c = JSON.parse(text)?.errors?.[0]?.code; return typeof c === "string" ? c.slice(0, 80) : undefined; } catch { return undefined; }
};
