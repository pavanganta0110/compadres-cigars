import { describe, expect, it } from "vitest";
import { selectPayment } from "../gate";
import { isAcceptableToken } from "../token";
import type { HttpRequest } from "../quickbooks/transport";
import { authorizenetConfigFromEnv, authorizenetConfigured } from "./config";
import { AuthorizeNetProvider, signAuthorizeNetWebhook } from "./provider";
import { acceptJsMessage, decodeAnetToken, encodeAnetToken } from "./token";

const cfg = { apiLoginId: "login1234", transactionKey: "txkey12345", signatureKey: "abcdef0123456789abcdef0123456789", clientKey: "client1234" };
const TOKEN = encodeAnetToken("eyJjb2RlIjoiNTBfMl8wNjAwMDUyN0Q0NTU4M0Q3MDVCRDAzMjRENUY5NEYyRjA2NTQ2NDJGNDQ5MDlBRjJDMDQ0M0Y4MUI4MDM2RjgwNTM1MDQ4MUQyNDUxMTg0RjQ0IiwidG9rZW4iOiI5NzY5MDg5NDg2OTQzMzczMjA0NjA0IiwidiI6IjEuMSJ9");
const BOM = "﻿";

function fake(responses: Record<string, unknown>[]) {
  const calls: { body: Record<string, unknown> }[] = [];
  const http = async (r: HttpRequest) => {
    calls.push({ body: JSON.parse(r.body ?? "{}") });
    return { status: 200, text: BOM + JSON.stringify(responses.shift() ?? {}) };
  };
  return { http, calls };
}
const ok = (transId: string) => ({ transactionResponse: { responseCode: "1", transId }, messages: { resultCode: "Ok", message: [{ code: "I00001" }] } });
const txReq = (c: { body: Record<string, unknown> }) => (c.body.createTransactionRequest as { transactionRequest: Record<string, unknown> }).transactionRequest;

describe("authorizenet token", () => {
  it("round-trips an Accept.js nonce and passes the shared token check", () => {
    const dv = "abc+def/ghijkl+mno/pqr12345678==";
    const t = encodeAnetToken(dv);
    expect(isAcceptableToken(t)).toBe(true);
    expect(decodeAnetToken(t)).toBe(dv.replace(/=+$/, "") + "=".repeat((4 - (dv.replace(/=+$/, "").length % 4)) % 4));
    expect(decodeAnetToken("mock_tok_approve_abc12345")).toBeNull();
  });
  it("accepts a realistic nonce length", () => expect(isAcceptableToken(TOKEN)).toBe(true));
});

describe("authorizenet gate and config", () => {
  const base = { appEnv: "local", provider: "authorizenet", approved: undefined, quickbooksConfigured: false };
  it("not configured is UNAVAILABLE, never mocked", () => {
    for (const appEnv of ["local", "staging", "production"]) expect(selectPayment({ ...base, appEnv, authorizenetConfigured: false })).toMatchObject({ kind: "unavailable", mode: "disabled" });
  });
  it("live ONLY when production AND approved=true", () => {
    const q = { ...base, authorizenetConfigured: true };
    expect(selectPayment({ ...q, appEnv: "production", approved: "true" })).toEqual({ kind: "authorizenet", mode: "live" });
    expect(selectPayment({ ...q, appEnv: "production", approved: "false" })).toEqual({ kind: "authorizenet", mode: "sandbox" });
    expect(selectPayment({ ...q, appEnv: "staging", approved: "true" })).toEqual({ kind: "authorizenet", mode: "sandbox" });
  });
  it("needs every credential", () => {
    expect(authorizenetConfigured(authorizenetConfigFromEnv({ AUTHNET_API_LOGIN_ID: "login1234", AUTHNET_TRANSACTION_KEY: "txkey12345", AUTHNET_SIGNATURE_KEY: "abcdef0123456789abcdef0123456789", AUTHNET_CLIENT_KEY: "client1234" }))).toBe(true);
    expect(authorizenetConfigured(authorizenetConfigFromEnv({ AUTHNET_API_LOGIN_ID: "login1234", AUTHNET_TRANSACTION_KEY: "txkey12345", AUTHNET_SIGNATURE_KEY: "abcdef0123456789abcdef0123456789" }))).toBe(false);
  });
});

describe("AuthorizeNetProvider", () => {
  it("authorizes (auth only) with the opaque token and a BOM-prefixed response", async () => {
    const f = fake([ok("60123456789")]);
    const p = new AuthorizeNetProvider("sandbox", cfg, f.http);
    expect(await p.authorize({ amountCents: 42999, token: TOKEN, idempotencyKey: "pay-1" })).toEqual({ ok: true, reference: "60123456789", amountCents: 42999 });
    const tr = txReq(f.calls[0]);
    expect(tr).toMatchObject({ transactionType: "authOnlyTransaction", amount: "429.99" });
    expect((tr.payment as { opaqueData: { dataDescriptor: string } }).opaqueData.dataDescriptor).toBe("COMMON.ACCEPT.INAPP.PAYMENT");
    expect(JSON.stringify(f.calls[0].body)).not.toContain("cardNumber");
  });
  it("maps a decline, a bad token and an outage without echoing processor text", async () => {
    const p = (r: Record<string, unknown>[]) => new AuthorizeNetProvider("sandbox", cfg, fake(r).http);
    expect(await p([{ transactionResponse: { responseCode: "2", errors: [{ errorCode: "2", errorText: "secret detail" }] }, messages: { resultCode: "Error" } }]).authorize({ amountCents: 100, token: TOKEN, idempotencyKey: "k" }))
      .toEqual({ ok: false, code: "declined", message: "The card was declined.", providerCode: "2" });
    expect(await p([{ messages: { resultCode: "Error", message: [{ code: "E00114" }] } }]).authorize({ amountCents: 100, token: TOKEN, idempotencyKey: "k" })).toMatchObject({ ok: false, code: "invalid_token" });
    expect(await p([]).authorize({ amountCents: 100, token: "mock_tok_approve_abc12345", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "invalid_token" });
    const down = new AuthorizeNetProvider("sandbox", cfg, async () => { throw new Error("net"); });
    expect(await down.authorize({ amountCents: 100, token: TOKEN, idempotencyKey: "k" })).toMatchObject({ ok: false, code: "provider_error" });
  });
  it("treats a held-for-review transaction as not approved", async () => {
    const p = new AuthorizeNetProvider("sandbox", cfg, fake([{ transactionResponse: { responseCode: "4", transId: "9" }, messages: { resultCode: "Ok" } }]).http);
    expect(await p.authorize({ amountCents: 100, token: TOKEN, idempotencyKey: "k" })).toMatchObject({ ok: false, providerCode: "held_for_review" });
  });
  it("captures and voids by reference", async () => {
    const f = fake([ok("60123456789"), ok("60123456790")]);
    const p = new AuthorizeNetProvider("sandbox", cfg, f.http);
    expect(await p.capture({ reference: "60123456789", amountCents: 1000, idempotencyKey: "c" })).toEqual({ ok: true, reference: "60123456789" });
    expect(await p.void({ reference: "60123456789", amountCents: 1000, idempotencyKey: "v" })).toEqual({ ok: true });
    expect(txReq(f.calls[0])).toMatchObject({ transactionType: "priorAuthCaptureTransaction", refTransId: "60123456789", amount: "10.00" });
    expect(txReq(f.calls[1])).toMatchObject({ transactionType: "voidTransaction", refTransId: "60123456789" });
  });
  it("refunds a settled charge with the card's last four digits", async () => {
    const f = fake([{ transaction: { transactionStatus: "settledSuccessfully", authAmount: 429.99, payment: { creditCard: { cardNumber: "XXXX1111" } } }, messages: { resultCode: "Ok" } }, ok("70000000001")]);
    const p = new AuthorizeNetProvider("sandbox", cfg, f.http);
    expect(await p.refund({ reference: "60123456789", amountCents: 1000, idempotencyKey: "r" })).toEqual({ ok: true, reference: "70000000001" });
    expect(txReq(f.calls[1])).toMatchObject({ transactionType: "refundTransaction", amount: "10.00", payment: { creditCard: { cardNumber: "1111", expirationDate: "XXXX" } } });
  });
  it("voids an unsettled charge refunded in full and refuses a partial refund until it settles", async () => {
    const details = { transaction: { transactionStatus: "capturedPendingSettlement", authAmount: 10 }, messages: { resultCode: "Ok" } };
    const full = fake([details, ok("70000000002")]);
    expect(await new AuthorizeNetProvider("sandbox", cfg, full.http).refund({ reference: "6", amountCents: 1000, idempotencyKey: "r" })).toEqual({ ok: true, reference: "70000000002" });
    expect(txReq(full.calls[1])).toMatchObject({ transactionType: "voidTransaction" });
    const part = fake([details]);
    expect(await new AuthorizeNetProvider("sandbox", cfg, part.http).refund({ reference: "6", amountCents: 500, idempotencyKey: "r" })).toMatchObject({ ok: false, providerCode: "unsettled_partial_refund" });
  });
});

describe("authorizenet webhook", () => {
  const body = JSON.stringify({ notificationId: "n-1", eventType: "net.authorize.payment.authcapture.created", payload: { id: "60123456789", authAmount: 429.99 } });
  const headers = (v: string | null) => ({ get: (n: string) => (n === "x-anet-signature" ? v : null) });
  const p = new AuthorizeNetProvider("sandbox", cfg, async () => ({ status: 200, text: "{}" }));
  it("accepts a correctly signed event (either case) and parses it", async () => {
    for (const sig of [signAuthorizeNetWebhook(cfg.signatureKey, body), signAuthorizeNetWebhook(cfg.signatureKey, body).toLowerCase()]) {
      expect(await p.verifyWebhook(body, headers(sig))).toEqual({ ok: true, events: [{ id: "n-1", type: "charge.captured", chargeRef: "60123456789", amountCents: 42999 }] });
    }
  });
  it("rejects missing, wrong and tampered signatures", async () => {
    expect(await p.verifyWebhook(body, headers(null))).toEqual({ ok: false, reason: "bad_signature" });
    expect(await p.verifyWebhook(body, headers(signAuthorizeNetWebhook("not-the-key-not-the-key", body)))).toEqual({ ok: false, reason: "bad_signature" });
    expect(await p.verifyWebhook(body + " ", headers(signAuthorizeNetWebhook(cfg.signatureKey, body)))).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("maps void and refund events", async () => {
    const v = JSON.stringify({ notificationId: "n-2", eventType: "net.authorize.payment.void.created", payload: { id: "1" } });
    const r = JSON.stringify({ notificationId: "n-3", eventType: "net.authorize.payment.refund.created", payload: { id: "2", authAmount: 5 } });
    expect(await p.verifyWebhook(v, headers(signAuthorizeNetWebhook(cfg.signatureKey, v)))).toMatchObject({ ok: true, events: [{ type: "charge.voided" }] });
    expect(await p.verifyWebhook(r, headers(signAuthorizeNetWebhook(cfg.signatureKey, r)))).toMatchObject({ ok: true, events: [{ type: "charge.refunded", refundRef: "2", amountCents: 500 }] });
  });
});

describe("acceptJsMessage", () => {
  it("explains known codes and only echoes a code of the expected shape", () => {
    expect(acceptJsMessage("E_WC_05")).toContain("card number");
    expect(acceptJsMessage("E_WC_10")).toContain("E_WC_10");
    expect(acceptJsMessage("<script>alert(1)</script>")).not.toContain("script");
    expect(acceptJsMessage(undefined)).toContain("could not read");
  });
});
