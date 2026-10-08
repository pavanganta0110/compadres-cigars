import { describe, expect, it } from "vitest";
import { redact } from "../domain/audit";
import { mockAllowed } from "../domain/providers";
import { selectPayment } from "./gate";
import { MockPaymentProvider, signMockWebhook, MOCK_SIGNATURE_HEADER } from "./mock";
import { checkRefund, parseDollarsToCents } from "./refund";
import { open, seal } from "./secretbox";
import { isAcceptableToken, mockTokenForCard } from "./token";
import { UnavailablePaymentProvider, type PaymentProvider } from "./types";

const hdr = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

describe("provider gating", () => {
  const base = { appEnv: "local", provider: undefined, approved: undefined, quickbooksConfigured: false };
  it("unset/mock is the mock, but only outside production", () => {
    expect(selectPayment(base)).toEqual({ kind: "mock", mode: "mock" });
    expect(selectPayment({ ...base, provider: "mock", appEnv: "staging" })).toEqual({ kind: "mock", mode: "mock" });
    expect(selectPayment({ ...base, appEnv: "production" })).toMatchObject({ kind: "unavailable" });
    expect(selectPayment({ ...base, provider: "mock", appEnv: "production", approved: "true" })).toMatchObject({ kind: "unavailable" });
    expect(mockAllowed("production")).toBe(false);
  });
  it("quickbooks selected but not configured is UNAVAILABLE, never mocked", () => {
    for (const appEnv of ["local", "staging", "production"]) expect(selectPayment({ ...base, provider: "quickbooks", appEnv })).toMatchObject({ kind: "unavailable", mode: "disabled" });
  });
  it("live ONLY when production AND approved=true; everything else is sandbox", () => {
    const q = { ...base, provider: "quickbooks", quickbooksConfigured: true };
    expect(selectPayment({ ...q, appEnv: "production", approved: "true" })).toEqual({ kind: "quickbooks", mode: "live" });
    expect(selectPayment({ ...q, appEnv: "production", approved: "false" })).toEqual({ kind: "quickbooks", mode: "sandbox" });
    expect(selectPayment({ ...q, appEnv: "production", approved: undefined })).toEqual({ kind: "quickbooks", mode: "sandbox" });
    expect(selectPayment({ ...q, appEnv: "production", approved: "TRUE" })).toEqual({ kind: "quickbooks", mode: "sandbox" });
    expect(selectPayment({ ...q, appEnv: "staging", approved: "true" })).toEqual({ kind: "quickbooks", mode: "sandbox" });
    expect(selectPayment({ ...q, appEnv: "local", approved: "true" })).toEqual({ kind: "quickbooks", mode: "sandbox" });
  });
  it("an unknown provider name is unavailable", () => {
    expect(selectPayment({ ...base, provider: "stripe" })).toMatchObject({ kind: "unavailable" });
  });
});

describe("tokens", () => {
  it("accepts opaque tokens and refuses anything shaped like a card number", () => {
    expect(isAcceptableToken("mock_tok_approve_abc12345")).toBe(true);
    expect(isAcceptableToken("4242424242424242")).toBe(false);
    expect(isAcceptableToken("4242 4242 4242 4242")).toBe(false);
    expect(isAcceptableToken("")).toBe(false);
    expect(isAcceptableToken("short")).toBe(false);
    expect(isAcceptableToken("has spaces and <script>")).toBe(false);
    expect(isAcceptableToken(undefined)).toBe(false);
  });
  it("mock tokenization maps test cards and never embeds the card number", () => {
    expect(mockTokenForCard("4242 4242 4242 4242", () => "x1")).toBe("mock_tok_approve_x1");
    expect(mockTokenForCard("4000-0000-0000-0002", () => "x2")).toBe("mock_tok_decline_x2");
    expect(mockTokenForCard("1234567812345678", () => "x3")).toBe("mock_tok_invalid_x3");
    expect(mockTokenForCard("4242424242424241", () => "x4")).toBe("mock_tok_invalid_x4");
    expect(mockTokenForCard("4242424242424242")).not.toContain("4242424242424242");
  });
});

describe("MockPaymentProvider", () => {
  const p = new MockPaymentProvider("s".repeat(32));
  it("authorize -> capture -> refund succeeds for an approving token, deterministically per idempotency key", async () => {
    const a = await p.authorize({ amountCents: 1500, token: "mock_tok_approve_a", idempotencyKey: "order1:1" });
    expect(a).toMatchObject({ ok: true, amountCents: 1500 });
    expect(await p.authorize({ amountCents: 1500, token: "mock_tok_approve_a", idempotencyKey: "order1:1" })).toEqual(a);
    if (!a.ok) throw new Error();
    const c = await p.capture({ reference: a.reference, amountCents: 1500, idempotencyKey: "order1:1" });
    expect(c).toMatchObject({ ok: true });
    if (!c.ok) throw new Error();
    expect(await p.refund({ reference: c.reference, amountCents: 500, idempotencyKey: "refund:1" })).toMatchObject({ ok: true });
    expect(await p.void({ reference: a.reference, amountCents: 1500, idempotencyKey: "v" })).toEqual({ ok: true });
  });
  it("declines the decline card and rejects unknown tokens and bad amounts", async () => {
    expect(await p.authorize({ amountCents: 100, token: "mock_tok_decline_a", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "declined" });
    expect(await p.authorize({ amountCents: 100, token: "mock_tok_invalid_a", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "invalid_token" });
    expect(await p.authorize({ amountCents: 100, token: "garbage_token_value", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "invalid_token" });
    expect(await p.authorize({ amountCents: 0, token: "mock_tok_approve_a", idempotencyKey: "k" })).toMatchObject({ ok: false });
    expect(await p.refund({ reference: "mock_ch_x", amountCents: -1, idempotencyKey: "k" })).toMatchObject({ ok: false });
  });
  it("webhooks: accepts a valid HMAC, fails closed on a bad or missing signature or secret", async () => {
    const body = JSON.stringify({ id: "evt_1", type: "charge.refunded", chargeRef: "mock_ch_1", refundRef: "mock_rf_1", amountCents: 100 });
    const sig = signMockWebhook("s".repeat(32), body);
    expect(await p.verifyWebhook(body, hdr({ [MOCK_SIGNATURE_HEADER]: sig }))).toMatchObject({ ok: true, events: [{ id: "evt_1", type: "charge.refunded", amountCents: 100 }] });
    expect(await p.verifyWebhook(body, hdr({ [MOCK_SIGNATURE_HEADER]: sig.replace(/.$/, "0") }))).toEqual({ ok: false, reason: "bad_signature" });
    expect(await p.verifyWebhook(body + " ", hdr({ [MOCK_SIGNATURE_HEADER]: sig }))).toEqual({ ok: false, reason: "bad_signature" });
    expect(await p.verifyWebhook(body, hdr({}))).toEqual({ ok: false, reason: "bad_signature" });
    expect(await new MockPaymentProvider("").verifyWebhook(body, hdr({ [MOCK_SIGNATURE_HEADER]: sig }))).toEqual({ ok: false, reason: "not_configured" });
  });
  it("UnavailablePaymentProvider fails everything", async () => {
    const u: PaymentProvider = new UnavailablePaymentProvider();
    expect(await u.authorize({ amountCents: 1, token: "x", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "unavailable" });
    expect(await u.verifyWebhook("{}", hdr({}))).toMatchObject({ ok: false });
  });
});

describe("refund validation", () => {
  it("parses dollars strictly into cents", () => {
    expect(parseDollarsToCents("10")).toBe(1000);
    expect(parseDollarsToCents("10.5")).toBe(1050);
    expect(parseDollarsToCents("0.01")).toBe(1);
    expect(parseDollarsToCents("$10")).toBeNull();
    expect(parseDollarsToCents("-1")).toBeNull();
    expect(parseDollarsToCents("0")).toBeNull();
    expect(parseDollarsToCents("1.234")).toBeNull();
    expect(parseDollarsToCents("1e3")).toBeNull();
    expect(parseDollarsToCents("")).toBeNull();
  });
  it("cannot exceed what was captured (including pending reservations)", () => {
    expect(checkRefund({ amountCents: 500, capturedCents: 1000, reservedCents: 500 })).toEqual({ ok: true });
    expect(checkRefund({ amountCents: 501, capturedCents: 1000, reservedCents: 500 })).toEqual({ ok: false, code: "exceeds_captured" });
    expect(checkRefund({ amountCents: 0, capturedCents: 1000, reservedCents: 0 })).toEqual({ ok: false, code: "invalid_amount" });
    expect(checkRefund({ amountCents: 1.5, capturedCents: 1000, reservedCents: 0 })).toEqual({ ok: false, code: "invalid_amount" });
    expect(checkRefund({ amountCents: 1, capturedCents: 0, reservedCents: 0 })).toEqual({ ok: false, code: "nothing_to_refund" });
  });
});

describe("secretbox + redact", () => {
  const k = "k".repeat(40);
  it("round-trips and detects tampering or the wrong key", () => {
    const s = seal(k, "refresh-token-value");
    expect(s).not.toContain("refresh-token-value");
    expect(open(k, s)).toBe("refresh-token-value");
    expect(open("j".repeat(40), s)).toBeNull();
    expect(open(k, s.slice(0, -2) + "AA")).toBeNull();
    expect(() => seal("short", "x")).toThrow();
  });
  it("redact keeps card data, tokens and keys out of audit details", () => {
    const out = JSON.stringify(redact({
      paymentToken: "mock_tok_approve_abcd", token: "t", cardNumber: "4242424242424242", cvv: "123", access_token: "a", refresh_token: "r",
      client_secret: "s", authorization: "Bearer x", note: "paid with 4242 4242 4242 4242", ok: "fine", nested: { api_key: "k", pan: "1", ref: "ch_1" },
    }));
    for (const leak of ["mock_tok", "4242", "123", "Bearer", "\"a\"", "\"r\"", "\"s\""]) expect(out).not.toContain(leak);
    expect(out).toContain("fine");
    expect(out).toContain("ch_1");
  });
});

describe("payment permissions", () => {
  it("only owner/manager refund; only the owner manages the processor connection", async () => {
    const { can } = await import("../domain/permissions");
    expect(["owner", "manager", "fulfillment", "viewer"].map((r) => can(r, "refund"))).toEqual([true, true, false, false]);
    expect(["owner", "manager", "fulfillment", "viewer"].map((r) => can(r, "manage_payments"))).toEqual([true, false, false, false]);
  });
});
