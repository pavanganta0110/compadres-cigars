import { describe, expect, it } from "vitest";
import { FedExClient, fetchTransport } from "./client";
import { fedexConfigFromEnv, isConfigured } from "./config";

/** Live FedEx SANDBOX check. Skipped unless FEDEX_LIVE=1 (never runs in CI). Run:
 *  FEDEX_LIVE=1 node --env-file=.env.staging node_modules/vitest/vitest.mjs run src/lib/shipping/fedex/live.test.ts */
describe.skipIf(process.env.FEDEX_LIVE !== "1")("FedEx sandbox (live)", () => {
  const cfg = fedexConfigFromEnv(process.env);
  const client = new FedExClient(cfg, fetchTransport);
  it("is configured for the sandbox", () => { expect(isConfigured(cfg)).toBe(true); expect(cfg.apiBaseUrl).toContain("sandbox"); });
  it("returns adult-signature rates", async () => {
    const rates = await client.rates({ country: "US", state: "KS", postalCode: "66101", weight: 3, weightUnit: "LB" });
    console.log("rates:", rates.map((r) => `${r.service} $${(r.cents / 100).toFixed(2)}`).join(", "));
    expect(rates.length).toBeGreaterThan(0);
    expect(rates.every((r) => r.adultSignature)).toBe(true);
  }, 30_000);
  it("tracking: reports whether the Track API is enabled on this FedEx project", async () => {
    try { console.log("track:", await client.track("794644790132")); } catch (e) { console.log("track unavailable (expected until the Track API is added):", (e as Error).message); }
  }, 30_000);
});
