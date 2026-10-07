import { describe, expect, it } from "vitest";
import { SelfAttestationProvider, type AgeVerificationProvider } from "./age";
import { evaluateCheckout, type CheckoutInput } from "./checkout";
import { MockShippingProvider, type ShippingProvider } from "./shipping";
import { buildComplianceSnapshot } from "./snapshot";
import { redact } from "./audit";
import { cartFingerprint } from "./fingerprint";
import { providerMode, mockAllowed } from "./providers";
import { evaluateDestination } from "./restrictions";
import { addToCart, parseCart, serializeCart } from "./cart";

const now = new Date("2026-10-07T12:00:00Z");
const base = (o: Partial<CheckoutInput> = {}): CheckoutInput => ({
  lines: [{ productId: "p1", sku: "S", name: "Box", quantity: 1, unitPriceCents: 14900, stock: 5 }],
  destination: { country: "US", state: "MO", postalCode: "64131" },
  restrictions: new Map([["MO", "allowed"]]), attested: true, chosenService: "mock_ground_asr",
  ageProvider: new SelfAttestationProvider(() => now), shippingProvider: new MockShippingProvider(), now, ...o,
});

describe("evaluateCheckout", () => {
  it("passes and totals subtotal + shipping + estimated tax", async () => {
    const r = await evaluateCheckout(base());
    expect(r.ok && [r.subtotalCents, r.shipping.cents, r.tax.tax_cents, r.totalCents]).toEqual([14900, 1450, 1258, 17608]);
  });
  it("blocks restricted and unlisted states (fail closed)", async () => {
    for (const state of ["TX", "ZZ", ""]) {
      const r = await evaluateCheckout(base({ destination: { country: "US", state, postalCode: "1" } }));
      expect(r).toMatchObject({ ok: false, step: "geography" });
    }
    expect(await evaluateCheckout(base({ restrictions: new Map([["MO", "blocked"]]) }))).toMatchObject({ step: "geography" });
  });
  it("blocks non-US destinations", async () => {
    expect(await evaluateCheckout(base({ destination: { country: "CA", state: "MO", postalCode: "1" } }))).toMatchObject({ step: "geography" });
  });
  it("blocks without age attestation", async () => {
    expect(await evaluateCheckout(base({ attested: false }))).toMatchObject({ ok: false, step: "age_verification" });
  });
  it("a provider returning an expired or pending result cannot pass", async () => {
    const mk = (status: "pending" | "passed", exp: Date): AgeVerificationProvider => ({
      name: "x", verify: async () => ({ provider: "x", reference: "r", status, verifiedAt: now, expiresAt: exp }),
    });
    expect(await evaluateCheckout(base({ ageProvider: mk("pending", new Date(+now + 1e6)) }))).toMatchObject({ step: "age_verification" });
    expect(await evaluateCheckout(base({ ageProvider: mk("passed", new Date(+now - 1)) }))).toMatchObject({ step: "age_verification" });
  });
  it("blocks a service that is not in the computed rates or lacks adult signature", async () => {
    expect(await evaluateCheckout(base({ chosenService: "free_shipping" }))).toMatchObject({ step: "shipping_eligibility" });
    const noAsr: ShippingProvider = { name: "n", rates: async () => [{ service: "ground", label: "g", cents: 100, adultSignature: false }] };
    expect(await evaluateCheckout(base({ shippingProvider: noAsr, chosenService: "ground" }))).toMatchObject({ step: "shipping_eligibility" });
  });
  it("checks in order: stock before geography before age before shipping", async () => {
    const all = base({ attested: false, chosenService: "bad", destination: { country: "US", state: "TX", postalCode: "1" } });
    expect(await evaluateCheckout({ ...all, lines: [{ ...all.lines[0], quantity: 9 }] })).toMatchObject({ step: "cart_stock" });
    expect(await evaluateCheckout(all)).toMatchObject({ step: "geography" });
    expect(await evaluateCheckout({ ...all, destination: base().destination })).toMatchObject({ step: "age_verification" });
    expect(await evaluateCheckout({ ...all, destination: base().destination, attested: true })).toMatchObject({ step: "shipping_eligibility" });
  });
  it("rejects empty carts and absurd quantities", async () => {
    expect(await evaluateCheckout(base({ lines: [] }))).toMatchObject({ step: "cart_stock" });
    expect(await evaluateCheckout(base({ lines: [{ ...base().lines[0], quantity: -1 }] }))).toMatchObject({ step: "cart_stock" });
  });
});

describe("snapshot", () => {
  it("records provider, reference, timestamps, tax provenance and the self-attestation warning", async () => {
    const r = await evaluateCheckout(base());
    if (!r.ok) throw new Error("x");
    const s = buildComplianceSnapshot({ now, country: "us", state: "mo", postalCode: "64131", age: r.age, service: "mock_ground_asr", tax: r.tax });
    expect(s.age).toMatchObject({ provider: "self_attestation", verified_at: now.toISOString() });
    expect(s.age.self_attestation_warning).toBeTruthy();
    expect(s.tax.estimate).toBe(true);
    expect(s.shipping.adult_signature_required).toBe(true);
  });
  it("refuses to snapshot a failed verification", async () => {
    const age = await new SelfAttestationProvider(() => now).verify({ attested: false });
    expect(() => buildComplianceSnapshot({ now, country: "US", state: "MO", postalCode: "1", age, service: "s", tax: {} as never })).toThrow();
  });
});

describe("idempotency fingerprint", () => {
  const f = (o = {}) => cartFingerprint({ items: [{ productId: "a", quantity: 1 }, { productId: "b", quantity: 2 }], country: "US", state: "MO", postalCode: "64131", shippingService: "G", sessionId: "s1", ...o });
  it("is stable under item order, case and spacing", async () => {
    expect(await f()).toBe(await f({ items: [{ productId: "b", quantity: 2 }, { productId: "a", quantity: 1 }], state: "mo", postalCode: "641 31", shippingService: "g" }));
  });
  it("changes with cart, destination, shipping method or session", async () => {
    const base = await f();
    for (const o of [{ state: "KS" }, { postalCode: "1" }, { shippingService: "x" }, { sessionId: "s2" }, { items: [{ productId: "a", quantity: 2 }] }]) expect(await f(o)).not.toBe(base);
  });
});

describe("audit redaction", () => {
  it("never keeps card numbers, tokens, keys or DOB", () => {
    const out = JSON.stringify(redact({ state: "MO", cardNumber: "4111111111111111", note: "4111 1111 1111 1111", api_key: "k", dob: "1990-01-01", nested: { access_token: "t" }, ok: 1 }));
    for (const bad of ["4111", "\"k\"", "1990", "\"t\""]) expect(out).not.toContain(bad);
    expect(out).toContain("MO");
  });
});

describe("provider gating", () => {
  it("is live only in production with explicit approval", () => {
    expect(providerMode({ appEnv: "production", configured: true, approved: "true" })).toBe("live");
    expect(providerMode({ appEnv: "production", configured: true, approved: "false" })).toBe("sandbox");
    expect(providerMode({ appEnv: "staging", configured: true, approved: "true" })).toBe("sandbox");
    expect(providerMode({ appEnv: "production", configured: false, approved: "true" })).toBe("disabled");
    expect(mockAllowed("production")).toBe(false);
    expect(mockAllowed("staging")).toBe(true);
  });
});

describe("restrictions + cart cookie", () => {
  it("only an explicit 'allowed' passes", () => {
    expect(evaluateDestination("US", "mo", new Map([["MO", "allowed"]])).allowed).toBe(true);
    expect(evaluateDestination("US", "MO", new Map()).allowed).toBe(false);
  });
  it("cart parsing rejects junk, keeps valid, caps quantity", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(parseCart("garbage")).toEqual([]);
    expect(parseCart(JSON.stringify([{ p: "x", q: 1 }]))).toEqual([]);
    expect(parseCart(serializeCart([{ productId: id, quantity: 2 }]))).toEqual([{ productId: id, quantity: 2 }]);
    expect(addToCart([{ productId: id, quantity: 98 }], id, 5)[0].quantity).toBe(99);
  });
});
