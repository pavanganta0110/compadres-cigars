import { isConfigured, type FedExConfig } from "./config";
import { normalizeRates, type FedExRate } from "./rates";
import { parseTrackingResponse, type TrackingStatus } from "./tracking";

export type Transport = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string }) => Promise<{ status: number; text: string }>;

export type RateRequest = { country: string; state: string; postalCode: string; weight: number; weightUnit: "LB" | "KG" };

export class FedExError extends Error {}
const fail = (m: string) => new FedExError(m);

/** FedEx REST: OAuth client_credentials, ACCOUNT rates with adult signature, and the Track API. Errors never carry secrets. */
export class FedExClient {
  private token: string | null = null;
  constructor(private cfg: FedExConfig, private transport: Transport) {}

  async rates(r: RateRequest): Promise<FedExRate[]> {
    const valid = /^[A-Z]{2}$/.test(r.country.toUpperCase()) && /^[A-Z0-9]{1,3}$/.test(r.state.toUpperCase())
      && /^[A-Z0-9 -]{3,10}$/.test(r.postalCode.toUpperCase()) && r.weight > 0 && r.weight <= 150;
    if (!isConfigured(this.cfg) || !valid) throw fail("FedEx rating is unavailable.");
    const res = await this.transport(`${this.cfg.apiBaseUrl}/rate/v1/rates/quotes`, {
      method: "POST", headers: await this.headers("application/json"), body: JSON.stringify(this.rateBody(r)),
    });
    if (res.status !== 200) throw fail("FedEx rating is unavailable.");
    return normalizeRates(this.decode(res.text, "FedEx rating is unavailable."));
  }

  async track(trackingNumber: string): Promise<TrackingStatus> {
    if (!isConfigured(this.cfg) || !/^[A-Za-z0-9]{6,34}$/.test(trackingNumber)) throw fail("FedEx tracking is unavailable.");
    const res = await this.transport(`${this.cfg.apiBaseUrl}/track/v1/trackingnumbers`, {
      method: "POST", headers: await this.headers("application/json"),
      body: JSON.stringify({ includeDetailedScans: false, trackingInfo: [{ trackingNumberInfo: { trackingNumber } }] }),
    });
    if (res.status !== 200) throw fail("FedEx tracking is unavailable.");
    try { return parseTrackingResponse(this.decode(res.text, "FedEx tracking is unavailable.")); } catch { throw fail("FedEx tracking is unavailable."); }
  }

  private async headers(contentType: string) {
    return { Accept: "application/json", Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": contentType, "X-locale": "en_US" };
  }

  private async accessToken(): Promise<string> {
    if (this.token) return this.token;
    const res = await this.transport(`${this.cfg.apiBaseUrl}/oauth/token`, {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret }).toString(),
    });
    if (res.status !== 200) throw fail("FedEx authorization is unavailable.");
    const t = (this.decode(res.text, "FedEx authorization is unavailable.") as { access_token?: unknown }).access_token;
    const token = typeof t === "string" ? t.trim() : "";
    if (!token || token.length > 4096) throw fail("FedEx authorization is unavailable.");
    return (this.token = token);
  }

  private rateBody(r: RateRequest) {
    return {
      accountNumber: { value: this.cfg.accountNumber }, carrierCodes: ["FDXE", "FDXG"],
      requestedShipment: {
        pickupType: "USE_SCHEDULED_PICKUP", rateRequestType: ["ACCOUNT"],
        shipper: { address: { countryCode: this.cfg.originCountry, stateOrProvinceCode: this.cfg.originState, postalCode: this.cfg.originPostalCode } },
        recipient: { address: { countryCode: r.country.toUpperCase(), stateOrProvinceCode: r.state.toUpperCase(), postalCode: r.postalCode.toUpperCase(), residential: true } },
        packagingType: "YOUR_PACKAGING",
        requestedPackageLineItems: [{
          groupPackageCount: 1, weight: { units: r.weightUnit, value: Math.round(r.weight * 100) / 100 },
          packageSpecialServices: { specialServiceTypes: ["SIGNATURE_OPTION"], signatureOptionType: "ADULT" },
        }],
      },
    };
  }

  private decode(text: string, message: string): unknown {
    if (!text || text.length > 1_048_576) throw fail(message);
    try { const v = JSON.parse(text); if (v && typeof v === "object") return v; } catch { /* fall through */ }
    throw fail(message);
  }
}

/** Real network transport with a hard timeout. */
export const fetchTransport: Transport = async (url, init) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  return { status: res.status, text: await res.text() };
};
