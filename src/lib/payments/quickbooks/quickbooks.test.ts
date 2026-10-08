import { describe, expect, it } from "vitest";
import { quickbooksConfigFromEnv, quickbooksConfigured, quickbooksTokenizeUrl } from "./config";
import { QuickBooksOAuth, authorizeUrl, type StoredTokens, type TokenStore } from "./oauth";
import { QB_SIGNATURE_HEADER, QuickBooksPaymentsProvider, signQuickBooksWebhook } from "./provider";
import type { HttpRequest, HttpResponse, Transport } from "./transport";

const CFG = quickbooksConfigFromEnv({
  COMPADRES_QUICKBOOKS_CLIENT_ID: "client-id-12345", COMPADRES_QUICKBOOKS_CLIENT_SECRET: "client-secret-12345",
  COMPADRES_QUICKBOOKS_REDIRECT_URI: "https://example.com/admin/payments/quickbooks/callback", COMPADRES_QUICKBOOKS_WEBHOOK_VERIFIER: "verifier-token-123",
  COMPADRES_TOKEN_ENCRYPTION_KEY: "e".repeat(40),
});
const json = (status: number, body: unknown): HttpResponse => ({ status, text: JSON.stringify(body) });

function memoryStore(initial: StoredTokens | null): TokenStore & { value: StoredTokens | null } {
  const s = { value: initial, async load() { return s.value; }, async save(t: StoredTokens) { s.value = t; } };
  return s;
}
/** Records every request; replies from a queue keyed by URL substring. */
function fake(routes: (r: HttpRequest) => HttpResponse | undefined) {
  const calls: HttpRequest[] = [];
  const t: Transport = async (r) => { calls.push(r); const x = routes(r); if (!x) throw new Error(`unexpected ${r.url}`); return x; };
  return { t, calls };
}
const fresh = (now: number): StoredTokens => ({ refreshToken: "refresh-1", accessToken: "access-1", accessExpiresAt: now + 3600_000 });

function provider(routes: (r: HttpRequest) => HttpResponse | undefined, mode: "sandbox" | "live" = "sandbox") {
  const now = 1_700_000_000_000;
  const store = memoryStore(fresh(now));
  const f = fake(routes);
  const oauth = new QuickBooksOAuth(CFG, store, f.t, () => now);
  return { p: new QuickBooksPaymentsProvider(mode, oauth, f.t, CFG.webhookVerifier), ...f, store };
}

describe("configuration", () => {
  it("requires credentials, an https redirect (http only for localhost) and an encryption key", () => {
    expect(quickbooksConfigured(CFG)).toBe(true);
    expect(quickbooksConfigured({ ...CFG, clientId: "" })).toBe(false);
    expect(quickbooksConfigured({ ...CFG, redirectUri: "http://example.com/cb" })).toBe(false);
    expect(quickbooksConfigured({ ...CFG, redirectUri: "http://localhost:3100/cb" })).toBe(true);
    expect(quickbooksConfigured({ ...CFG, encryptionKey: "short" })).toBe(false);
  });
  it("uses Intuit's sandbox host unless live", () => {
    expect(quickbooksTokenizeUrl("sandbox")).toBe("https://sandbox.api.intuit.com/quickbooks/v4/payments/tokens");
    expect(quickbooksTokenizeUrl("live")).toBe("https://api.intuit.com/quickbooks/v4/payments/tokens");
  });
  it("builds the consent URL with the Payments scope and the state", () => {
    const u = new URL(authorizeUrl(CFG, "st4te"));
    expect(u.searchParams.get("scope")).toBe("com.intuit.quickbooks.payment");
    expect(u.searchParams.get("state")).toBe("st4te");
    expect(u.searchParams.get("redirect_uri")).toBe(CFG.redirectUri);
  });
});

describe("authorize", () => {
  it("sends an uncaptured charge to the sandbox with a Request-Id and the token, in dollars", async () => {
    const { p, calls } = provider(() => json(201, { id: "ch_1", status: "AUTHORIZED", amount: "149.00" }));
    const r = await p.authorize({ amountCents: 14900, token: "tok_abc12345", idempotencyKey: "order-1:1" });
    expect(r).toEqual({ ok: true, reference: "ch_1", amountCents: 14900 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://sandbox.api.intuit.com/quickbooks/v4/payments/charges");
    expect(calls[0].headers["Request-Id"]).toBe("order-1:1");
    expect(calls[0].headers.Authorization).toBe("Bearer access-1");
    expect(JSON.parse(calls[0].body!)).toMatchObject({ amount: "149.00", currency: "USD", token: "tok_abc12345", capture: false });
  });
  it("uses the production host only in live mode", async () => {
    const { p, calls } = provider(() => json(201, { id: "ch_1", status: "AUTHORIZED" }), "live");
    await p.authorize({ amountCents: 100, token: "tok_abc12345", idempotencyKey: "k" });
    expect(calls[0].url.startsWith("https://api.intuit.com/")).toBe(true);
  });
  it("maps DECLINED to a decline", async () => {
    const { p } = provider(() => json(201, { id: "ch_9", status: "DECLINED" }));
    expect(await p.authorize({ amountCents: 100, token: "tok_abc12345", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "declined" });
  });
  it("treats an unexpected status, a missing id or an amount mismatch as a provider error", async () => {
    for (const body of [{ id: "x", status: "CAPTURED" }, { status: "AUTHORIZED" }, { id: "x", status: "AUTHORIZED", amount: "1.00" }]) {
      const { p } = provider(() => json(201, body));
      expect(await p.authorize({ amountCents: 100000, token: "tok_abc12345", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "provider_error" });
    }
  });
  it("maps a token error, other 4xx/5xx, and network failure; never echoes processor text", async () => {
    const tok = provider(() => json(400, { errors: [{ code: "PMT-4000", message: "Token is invalid or expired 4242424242424242", detail: "secret detail" }] }));
    const r1 = await tok.p.authorize({ amountCents: 100, token: "tok_abc12345", idempotencyKey: "k" });
    expect(r1).toMatchObject({ ok: false, code: "invalid_token", providerCode: "PMT-4000" });
    expect(JSON.stringify(r1)).not.toMatch(/4242|secret/);
    const bad = provider(() => json(500, "<html>boom</html>"));
    expect(await bad.p.authorize({ amountCents: 100, token: "tok_abc12345", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "provider_error" });
    const net = provider(() => { throw new Error("socket hang up"); });
    expect(await net.p.authorize({ amountCents: 100, token: "tok_abc12345", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "provider_error" });
  });
});

describe("capture, void, refund", () => {
  it("captures with the amount and requires CAPTURED", async () => {
    const ok = provider((r) => (r.url.endsWith("/charges/ch_1/capture") ? json(200, { id: "ch_1", status: "CAPTURED" }) : undefined));
    expect(await ok.p.capture({ reference: "ch_1", amountCents: 14900, idempotencyKey: "order-1:1:c" })).toEqual({ ok: true, reference: "ch_1" });
    expect(JSON.parse(ok.calls[0].body!)).toMatchObject({ amount: "149.00" });
    const bad = provider(() => json(200, { id: "ch_1", status: "AUTHORIZED" }));
    expect(await bad.p.capture({ reference: "ch_1", amountCents: 100, idempotencyKey: "k" })).toMatchObject({ ok: false });
  });
  it("refunds a partial amount against the charge and returns the refund id", async () => {
    const { p, calls } = provider((r) => (r.url.endsWith("/charges/ch_1/refunds") ? json(201, { id: "rf_1", status: "ISSUED", type: "REFUND" }) : undefined));
    expect(await p.refund({ reference: "ch_1", amountCents: 2550, idempotencyKey: "refund:abc", reason: "Damaged" })).toEqual({ ok: true, reference: "rf_1" });
    expect(JSON.parse(calls[0].body!)).toMatchObject({ amount: "25.50", description: "Damaged" });
    expect(calls[0].headers["Request-Id"]).toBe("refund:abc");
  });
  it("a failed refund is reported, not swallowed", async () => {
    const { p } = provider(() => json(400, { errors: [{ code: "PMT-5000", message: "x" }] }));
    expect(await p.refund({ reference: "ch_1", amountCents: 100, idempotencyKey: "k" })).toMatchObject({ ok: false, code: "provider_error" });
    expect(await p.void({ reference: "ch_1", amountCents: 100, idempotencyKey: "k" })).toMatchObject({ ok: false });
  });
  it("encodes the charge id into the path", async () => {
    const { p, calls } = provider(() => json(200, { id: "x", status: "CAPTURED" }));
    await p.capture({ reference: "../evil/id", amountCents: 100, idempotencyKey: "k" });
    expect(calls[0].url).toContain("/charges/..%2Fevil%2Fid/capture");
  });
});

describe("OAuth", () => {
  const tokenOk = (a: string, r: string) => json(200, { access_token: a, refresh_token: r, expires_in: 3600, x_refresh_token_expires_in: 8640000 });
  it("refreshes an expired access token and stores the ROTATED refresh token before use", async () => {
    const now = 1_700_000_000_000;
    const store = memoryStore({ refreshToken: "refresh-1", accessToken: "old", accessExpiresAt: now - 1000 });
    const f = fake((r) => (r.url.includes("oauth.platform.intuit.com") ? tokenOk("access-2", "refresh-2") : json(201, { id: "ch_1", status: "AUTHORIZED" })));
    const p = new QuickBooksPaymentsProvider("sandbox", new QuickBooksOAuth(CFG, store, f.t, () => now), f.t, "");
    expect((await p.authorize({ amountCents: 100, token: "tok_abc12345", idempotencyKey: "k" })).ok).toBe(true);
    expect(store.value?.refreshToken).toBe("refresh-2");
    expect(f.calls[0].headers.Authorization).toMatch(/^Basic /);
    expect(f.calls[0].body).toContain("grant_type=refresh_token");
    expect(f.calls[1].headers.Authorization).toBe("Bearer access-2");
  });
  it("retries once with a fresh token after a 401", async () => {
    const now = 1_700_000_000_000;
    const store = memoryStore(fresh(now));
    let charge = 0;
    const f = fake((r) => r.url.includes("oauth.platform") ? tokenOk("access-3", "refresh-3") : ++charge === 1 ? json(401, {}) : json(201, { id: "ch_1", status: "AUTHORIZED" }));
    const p = new QuickBooksPaymentsProvider("sandbox", new QuickBooksOAuth(CFG, store, f.t, () => now), f.t, "");
    // after the 401 the cached token is dropped; the stored one is still "fresh", so force expiry by clearing it
    store.value = { refreshToken: "refresh-1" };
    expect((await p.authorize({ amountCents: 100, token: "tok_abc12345", idempotencyKey: "k" })).ok).toBe(true);
  });
  it("reports unavailable (not a crash) when QuickBooks is not connected or the refresh token is dead", async () => {
    const f = fake((r) => (r.url.includes("oauth.platform") ? json(400, { error: "invalid_grant" }) : undefined));
    const none = new QuickBooksPaymentsProvider("sandbox", new QuickBooksOAuth(CFG, memoryStore(null), f.t), f.t, "");
    expect(await none.authorize({ amountCents: 100, token: "tok_abc12345", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "unavailable" });
    const dead = new QuickBooksPaymentsProvider("sandbox", new QuickBooksOAuth(CFG, memoryStore({ refreshToken: "r" }), f.t), f.t, "");
    expect(await dead.authorize({ amountCents: 100, token: "tok_abc12345", idempotencyKey: "k" })).toMatchObject({ ok: false, code: "unavailable" });
  });
  it("exchanges an authorization code and stores the tokens", async () => {
    const store = memoryStore(null);
    const f = fake(() => tokenOk("a", "r"));
    await new QuickBooksOAuth(CFG, store, f.t).exchangeCode("auth-code");
    expect(store.value?.refreshToken).toBe("r");
    expect(f.calls[0].body).toContain("grant_type=authorization_code");
    const bad = fake(() => json(400, {}));
    await expect(new QuickBooksOAuth(CFG, memoryStore(null), bad.t).exchangeCode("x")).rejects.toThrow();
  });
});

describe("webhook verification", () => {
  const hdr = (v?: string) => ({ get: (n: string) => (n.toLowerCase() === QB_SIGNATURE_HEADER && v ? v : null) });
  const body = JSON.stringify({ eventNotifications: [{ realmId: "123", dataChangeEvent: { entities: [{ name: "Payment", id: "42", operation: "Create", lastUpdated: "2026-10-08T00:00:00Z" }] } }] });
  const { p } = provider(() => undefined);
  it("accepts a valid Intuit signature and derives stable event ids", async () => {
    const r = await p.verifyWebhook(body, hdr(signQuickBooksWebhook(CFG.webhookVerifier, body)));
    expect(r.ok && r.events).toHaveLength(1);
    const again = await p.verifyWebhook(body, hdr(signQuickBooksWebhook(CFG.webhookVerifier, body)));
    expect(r.ok && again.ok && r.events[0].id === again.events[0].id).toBe(true);
  });
  it("fails closed: wrong signature, tampered body, no header, malformed JSON, no verifier configured", async () => {
    const sig = signQuickBooksWebhook(CFG.webhookVerifier, body);
    expect(await p.verifyWebhook(body, hdr(signQuickBooksWebhook("other-verifier", body)))).toEqual({ ok: false, reason: "bad_signature" });
    expect(await p.verifyWebhook(body + "x", hdr(sig))).toEqual({ ok: false, reason: "bad_signature" });
    expect(await p.verifyWebhook(body, hdr())).toEqual({ ok: false, reason: "bad_signature" });
    const junk = "not json";
    expect(await p.verifyWebhook(junk, hdr(signQuickBooksWebhook(CFG.webhookVerifier, junk)))).toEqual({ ok: false, reason: "bad_payload" });
    const noVerifier = new QuickBooksPaymentsProvider("sandbox", new QuickBooksOAuth(CFG, memoryStore(null), async () => ({ status: 200, text: "" })), async () => ({ status: 200, text: "" }), "");
    expect(await noVerifier.verifyWebhook(body, hdr(sig))).toEqual({ ok: false, reason: "not_configured" });
  });
});
