import { describe, expect, it } from "vitest";
import type { Transport } from "./client";
import { diagnoseFedEx } from "./diagnose";

const ENV = { APP_ENV: "staging", COMPADRES_SHIPPING_PROVIDER: "fedex", COMPADRES_FEDEX_API_BASE_URL: "https://apis-sandbox.fedex.com", COMPADRES_FEDEX_CLIENT_ID: "cid", COMPADRES_FEDEX_CLIENT_SECRET: "SECRET-VALUE",
  COMPADRES_FEDEX_ACCOUNT_NUMBER: "740561073", COMPADRES_FEDEX_ORIGIN_COUNTRY: "US", COMPADRES_FEDEX_ORIGIN_STATE: "MO", COMPADRES_FEDEX_ORIGIN_POSTAL_CODE: "64131" };
const t = (rate: { status: number; body: unknown }, auth: { status: number; body: unknown } = { status: 200, body: { access_token: "TOK" } }): Transport => async (url) => {
  const r = url.endsWith("/oauth/token") ? auth : rate;
  return { status: r.status, text: JSON.stringify(r.body) };
};
const okRates = { transactionId: "x", output: { rateReplyDetails: [{ serviceType: "A", signatureOptionType: "ADULT" }] } };

describe("diagnoseFedEx", () => {
  it("reports success with the number of adult-signature rates", async () => {
    expect(await diagnoseFedEx(ENV, t({ status: 200, body: okRates }))).toMatchObject({ ok: true, step: "done" });
  });
  it("explains a provider that is not selected and missing settings by NAME only", async () => {
    expect((await diagnoseFedEx({ ...ENV, COMPADRES_SHIPPING_PROVIDER: "" }, t({ status: 200, body: okRates }))).summary).toMatch(/mock rates/);
    const d = await diagnoseFedEx({ ...ENV, COMPADRES_FEDEX_CLIENT_SECRET: "", COMPADRES_FEDEX_ACCOUNT_NUMBER: "123" }, t({ status: 200, body: okRates }));
    expect(d).toMatchObject({ ok: false, step: "config" });
    expect(d.summary).toContain("COMPADRES_FEDEX_CLIENT_SECRET");
    expect(d.summary).toContain("COMPADRES_FEDEX_ACCOUNT_NUMBER");
  });
  it("distinguishes authorization failures from rate failures and surfaces the FedEx error code", async () => {
    expect(await diagnoseFedEx(ENV, t({ status: 200, body: okRates }, { status: 401, body: {} }))).toMatchObject({ step: "authorization" });
    const d = await diagnoseFedEx(ENV, t({ status: 400, body: { errors: [{ code: "ACCOUNT.NUMBER.MISMATCH", message: "x" }] } }));
    expect(d).toMatchObject({ ok: false, step: "rates", fedexCode: "ACCOUNT.NUMBER.MISMATCH" });
    expect(d.summary).toMatch(/does not belong/);
  });
  it("shows which key is configured (first 4 chars) and explains HTTP 403", async () => {
    const d = await diagnoseFedEx({ ...ENV, COMPADRES_FEDEX_CLIENT_ID: "l737abcdef" }, t({ status: 403, body: { errors: [{ code: "FORBIDDEN.ERROR" }] } }));
    expect(d.summary).toContain("key l737…");
    expect(d.summary).toContain("account …073");
    expect(d.summary).toMatch(/not allowed to use the Rates API/);
    expect(d.summary).not.toContain("l737abcdef");
  });
  it("never includes the secret in any output", async () => {
    for (const rate of [{ status: 200, body: okRates }, { status: 500, body: { errors: [{ code: "X" }] } }]) {
      expect(JSON.stringify(await diagnoseFedEx(ENV, t(rate)))).not.toContain("SECRET-VALUE");
    }
  });
});
