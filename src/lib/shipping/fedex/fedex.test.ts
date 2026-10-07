import { describe, expect, it } from "vitest";
import { FedExClient, FedExError, type Transport } from "./client";
import { fedexConfigFromEnv, isConfigured, type FedExConfig } from "./config";
import { normalizeRates } from "./rates";
import { isDelivered, needsAttention, parseTrackingResponse } from "./tracking";
import { normalizeWeight } from "./weight";

const ENV = { APP_ENV: "local", COMPADRES_FEDEX_API_BASE_URL: "https://apis-sandbox.fedex.com", COMPADRES_FEDEX_CLIENT_ID: "cid", COMPADRES_FEDEX_CLIENT_SECRET: "sec",
  COMPADRES_FEDEX_ACCOUNT_NUMBER: "123456789", COMPADRES_FEDEX_ORIGIN_COUNTRY: "us", COMPADRES_FEDEX_ORIGIN_STATE: "mo", COMPADRES_FEDEX_ORIGIN_POSTAL_CODE: "64131" };
const cfg = (o: Partial<Record<string, string>> = {}): FedExConfig => fedexConfigFromEnv({ ...ENV, ...o } as Record<string, string | undefined>);

describe("configuration gate", () => {
  it("is configured in sandbox with the sandbox host", () => expect(isConfigured(cfg())).toBe(true));
  it("rejects the production host outside production and the sandbox host in production", () => {
    expect(isConfigured(cfg({ COMPADRES_FEDEX_API_BASE_URL: "https://apis.fedex.com" }))).toBe(false);
    expect(isConfigured(cfg({ APP_ENV: "production", COMPADRES_SHIPPING_PRODUCTION_APPROVED: "true" }))).toBe(false);
  });
  it("production needs BOTH the production host and explicit approval", () => {
    const prod = { APP_ENV: "production", COMPADRES_FEDEX_API_BASE_URL: "https://apis.fedex.com" };
    expect(isConfigured(cfg(prod))).toBe(false);
    expect(isConfigured(cfg({ ...prod, COMPADRES_SHIPPING_PRODUCTION_APPROVED: "yes" }))).toBe(false);
    expect(isConfigured(cfg({ ...prod, COMPADRES_SHIPPING_PRODUCTION_APPROVED: "true" }))).toBe(true);
  });
  it("rejects bad credentials and origin", () => {
    for (const bad of [{ COMPADRES_FEDEX_ACCOUNT_NUMBER: "12345" }, { COMPADRES_FEDEX_CLIENT_ID: "" }, { COMPADRES_FEDEX_CLIENT_SECRET: "" }, { COMPADRES_FEDEX_ORIGIN_STATE: "" }, { COMPADRES_FEDEX_CLIENT_ID: "a b" }]) {
      expect(isConfigured(cfg(bad))).toBe(false);
    }
  });
});

const rateBody = (extra: Record<string, unknown>[] = []) => ({
  transactionId: "tx-1",
  output: { rateReplyDetails: [
    { serviceType: "PRIORITY_OVERNIGHT", serviceName: "FedEx Priority Overnight", signatureOptionType: "ADULT", ratedShipmentDetails: [{ rateType: "LIST", totalNetCharge: 99 }, { rateType: "ACCOUNT", totalNetCharge: 41.5, shipmentRateDetail: { currency: "USD" } }] },
    { serviceType: "FEDEX_GROUND", signatureOptionType: "SERVICE_DEFAULT", ratedShipmentDetails: [{ rateType: "ACCOUNT", totalNetCharge: 12, shipmentRateDetail: { currency: "USD" } }] },
    { serviceType: "FEDEX_2_DAY", signatureOptionType: "ADULT", ratedShipmentDetails: [{ rateType: "LIST", totalNetCharge: 20 }] },
    ...extra,
  ] },
});

describe("rates", () => {
  it("keeps only ADULT-signature rates that have an ACCOUNT charge, converted to cents", () => {
    expect(normalizeRates(rateBody())).toEqual([{ service: "priority_overnight", label: "FedEx Priority Overnight", cents: 4150, currency: "USD", adultSignature: true, reference: "tx-1:priority_overnight" }]);
  });
  it("drops negative, non-numeric and bad-currency charges; strips markup from labels", () => {
    const bad = [
      { serviceType: "A", signatureOptionType: "ADULT", ratedShipmentDetails: [{ rateType: "ACCOUNT", totalNetCharge: -1, shipmentRateDetail: { currency: "USD" } }] },
      { serviceType: "B", signatureOptionType: "ADULT", ratedShipmentDetails: [{ rateType: "ACCOUNT", totalNetCharge: "9", shipmentRateDetail: { currency: "USD" } }] },
      { serviceType: "C", signatureOptionType: "ADULT", ratedShipmentDetails: [{ rateType: "ACCOUNT", totalNetCharge: 9, shipmentRateDetail: { currency: "US" } }] },
      { serviceType: "D", serviceName: "<b>Fast</b>  one", signatureOptionType: "ADULT", ratedShipmentDetails: [{ rateType: "ACCOUNT", totalNetCharge: 9, shipmentRateDetail: { currency: "USD" } }] },
    ];
    const r = normalizeRates(rateBody(bad));
    expect(r.map((x) => x.service)).toEqual(["priority_overnight", "d"]);
    expect(r[1].label).toBe("Fast one");
  });
  it("returns nothing for malformed or transaction-less responses", () => {
    for (const b of [null, {}, { transactionId: "t" }, { output: { rateReplyDetails: [] } }, "x"]) expect(normalizeRates(b)).toEqual([]);
  });
});

describe("tracking status", () => {
  const wrap = (r: unknown) => ({ output: { completeTrackResults: [{ trackResults: [r] }] } });
  it("parses delivered, in transit, out for delivery and exceptions", () => {
    const s = (code: string) => parseTrackingResponse(wrap({ latestStatusDetail: { code, statusByLocale: "Status" } }));
    expect(isDelivered(s("DL"))).toBe(true);
    expect(isDelivered(s("IT"))).toBe(false);
    expect(s("od").code).toBe("OD");
    expect(needsAttention(s("DE"))).toBe(true);
    expect(needsAttention(s("SE"))).toBe(true);
    expect(needsAttention(s("IT"))).toBe(false);
  });
  it("treats TRACKING.TRACKINGNUMBER.NOTFOUND as not yet in the FedEx system", () => {
    expect(parseTrackingResponse(wrap({ error: { code: "TRACKING.TRACKINGNUMBER.NOTFOUND" } }))).toEqual({ code: "NOTFOUND", text: "Not yet in the FedEx system" });
  });
  it("throws on unexpected shapes", () => {
    for (const b of [null, {}, wrap({}), wrap({ latestStatusDetail: { code: "", statusByLocale: "x" } })]) expect(() => parseTrackingResponse(b)).toThrow();
  });
});

describe("weight", () => {
  it("normalizes ounces, pounds, grams and kilograms; unknown or zero is empty", () => {
    expect(normalizeWeight(48, "oz")).toEqual({ value: 3, unit: "LB" });
    expect(normalizeWeight(2.5, "lbs")).toEqual({ value: 2.5, unit: "LB" });
    expect(normalizeWeight(1500, "g")).toEqual({ value: 1.5, unit: "KG" });
    expect(normalizeWeight(0, "oz").value).toBe(0);
    expect(normalizeWeight(5, "stone").value).toBe(0);
    expect(normalizeWeight(NaN, "oz").value).toBe(0);
  });
});

function fake(handlers: Record<string, { status: number; body: unknown }>) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const t: Transport = async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });
    const key = Object.keys(handlers).find((k) => url.endsWith(k));
    if (!key) throw new Error("unexpected url " + url);
    return { status: handlers[key].status, text: JSON.stringify(handlers[key].body) };
  };
  return { t, calls };
}
const oauth = { "/oauth/token": { status: 200, body: { access_token: "TOK" } } };

describe("FedExClient with a separate tracking project", () => {
  it("authorizes rates and tracking with their own keys", async () => {
    const calls: { url: string; body: string }[] = [];
    const t: Transport = async (url, init) => {
      calls.push({ url, body: init.body });
      if (url.endsWith("/oauth/token")) return { status: 200, text: JSON.stringify({ access_token: new URLSearchParams(init.body).get("client_id") === "track-id" ? "TRACKTOK" : "RATETOK" }) };
      if (url.endsWith("/rate/v1/rates/quotes")) return { status: 200, text: JSON.stringify(rateBody()) };
      return { status: 200, text: JSON.stringify({ output: { completeTrackResults: [{ trackResults: [{ latestStatusDetail: { code: "IT", statusByLocale: "In transit" } }] }] } }) };
    };
    const c = new FedExClient(cfg({ COMPADRES_FEDEX_TRACK_CLIENT_ID: "track-id", COMPADRES_FEDEX_TRACK_CLIENT_SECRET: "track-secret" }), t);
    await c.rates({ country: "US", state: "KS", postalCode: "66101", weight: 3, weightUnit: "LB" });
    await c.track("794644790132");
    const ids = calls.filter((x) => x.url.endsWith("/oauth/token")).map((x) => new URLSearchParams(x.body).get("client_id"));
    expect(ids).toEqual(["cid", "track-id"]);
  });
  it("falls back to the main key when no tracking key is set", async () => {
    const ids: (string | null)[] = [];
    const t: Transport = async (url, init) => {
      if (url.endsWith("/oauth/token")) { ids.push(new URLSearchParams(init.body).get("client_id")); return { status: 200, text: JSON.stringify({ access_token: "T" }) }; }
      return { status: 200, text: JSON.stringify({ output: { completeTrackResults: [{ trackResults: [{ latestStatusDetail: { code: "DL", statusByLocale: "Delivered" } }] }] } }) };
    };
    await new FedExClient(cfg(), t).track("794644790132");
    expect(ids).toEqual(["cid"]);
  });
});

describe("FedExClient", () => {
  const req = { country: "US", state: "KS", postalCode: "66101", weight: 3, weightUnit: "LB" as const };
  it("authorizes once with client credentials, then rates with ACCOUNT + ADULT signature", async () => {
    const { t, calls } = fake({ ...oauth, "/rate/v1/rates/quotes": { status: 200, body: rateBody() } });
    const client = new FedExClient(cfg(), t);
    expect((await client.rates(req)).length).toBe(1);
    await client.rates(req);
    expect(calls.filter((c) => c.url.endsWith("/oauth/token"))).toHaveLength(1);
    expect(new URLSearchParams(calls[0].body).get("grant_type")).toBe("client_credentials");
    const body = JSON.parse(calls[1].body);
    expect(body.requestedShipment.rateRequestType).toEqual(["ACCOUNT"]);
    expect(body.requestedShipment.requestedPackageLineItems[0].packageSpecialServices).toEqual({ specialServiceTypes: ["SIGNATURE_OPTION"], signatureOptionType: "ADULT" });
    expect(body.accountNumber.value).toBe("123456789");
    expect(calls[1].headers.Authorization).toBe("Bearer TOK");
  });
  it("fails closed on bad input, unconfigured gate, and non-200 responses without leaking secrets", async () => {
    const { t } = fake({ ...oauth, "/rate/v1/rates/quotes": { status: 500, body: {} } });
    await expect(new FedExClient(cfg(), t).rates(req)).rejects.toThrow(FedExError);
    await expect(new FedExClient(cfg(), t).rates({ ...req, weight: 0 })).rejects.toThrow();
    await expect(new FedExClient(cfg(), t).rates({ ...req, weight: 151 })).rejects.toThrow();
    await expect(new FedExClient(cfg(), t).rates({ ...req, postalCode: "!" })).rejects.toThrow();
    await expect(new FedExClient(cfg({ COMPADRES_FEDEX_CLIENT_ID: "" }), t).rates(req)).rejects.toThrow();
    const bad = fake({ "/oauth/token": { status: 401, body: { error: "sec" } } });
    await expect(new FedExClient(cfg(), bad.t).rates(req)).rejects.toThrow(/authorization is unavailable/);
  });
  it("tracks and treats the Track API 403 as unavailable", async () => {
    const ok = fake({ ...oauth, "/track/v1/trackingnumbers": { status: 200, body: { output: { completeTrackResults: [{ trackResults: [{ latestStatusDetail: { code: "IT", statusByLocale: "In transit" } }] }] } } } });
    expect(await new FedExClient(cfg(), ok.t).track("794644790132")).toEqual({ code: "IT", text: "In transit" });
    const denied = fake({ ...oauth, "/track/v1/trackingnumbers": { status: 403, body: {} } });
    await expect(new FedExClient(cfg(), denied.t).track("794644790132")).rejects.toThrow(/tracking is unavailable/);
    await expect(new FedExClient(cfg(), ok.t).track("bad number!")).rejects.toThrow();
  });
});
