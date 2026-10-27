import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { authorizenetApiUrl, type AuthorizeNetConfig } from "./config";
import { ANET_DESCRIPTOR, decodeAnetToken } from "./token";
import type { Transport } from "../quickbooks/transport";
import type {
  AuthorizeRequest, AuthorizeResult, CaptureRequest, CaptureResult, PaymentEvent, PaymentFailure, PaymentProvider,
  RefundRequest, RefundResult, VoidRequest, VoidResult, WebhookVerification,
} from "../types";

export const ANET_SIGNATURE_HEADER = "x-anet-signature";
const dollars = (cents: number) => (cents / 100).toFixed(2);
const toCents = (v: unknown) => (typeof v === "string" || typeof v === "number") && Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : NaN;
/** Authorize.net's refId is at most 20 characters. Derived from our idempotency key so a retry carries the same id. */
const refId = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 20);

const FAIL = {
  declined: { code: "declined", message: "The card was declined." },
  invalid_token: { code: "invalid_token", message: "The card details could not be used." },
  provider_error: { code: "provider_error", message: "The payment processor could not complete the request." },
  unavailable: { code: "unavailable", message: "Payments are not connected." },
} as const;
const failure = (k: keyof typeof FAIL, providerCode?: string): PaymentFailure => ({ ok: false, ...FAIL[k], ...(providerCode ? { providerCode } : {}) });
const safeCode = (v: unknown) => (typeof v === "string" && /^[\w.-]{1,40}$/.test(v) ? v : undefined);

type Json = Record<string, unknown>;
type Tx = { responseCode?: string; transId?: string; errors?: { errorCode?: string }[]; messages?: { code?: string }[] };
type Messages = { resultCode?: string; message?: { code?: string }[] };

/**
 * Authorize.net AIM (JSON API) with Accept.js tokens. The card is tokenized in the browser; this class only sees the
 * opaque nonce. Processor error text is never copied into messages, only a sanitized code.
 * NOTE: shapes follow Authorize.net's public API reference and are covered by fake-transport tests; they have NOT been
 * exercised against Authorize.net's sandbox from this codebase yet.
 */
export class AuthorizeNetProvider implements PaymentProvider {
  readonly name = "authorizenet" as const;
  constructor(readonly mode: "sandbox" | "live", private cfg: AuthorizeNetConfig, private http: Transport) {}

  private auth() { return { name: this.cfg.apiLoginId, transactionKey: this.cfg.transactionKey }; }

  private async call(body: Json): Promise<{ ok: true; json: Json } | { ok: false; failure: PaymentFailure }> {
    let res;
    try { res = await this.http({ method: "POST", url: authorizenetApiUrl(this.mode), body: JSON.stringify(body), headers: { "Content-Type": "application/json", Accept: "application/json" } }); }
    catch { return { ok: false, failure: failure("provider_error") }; }
    if (res.status < 200 || res.status >= 300) return { ok: false, failure: failure("provider_error") };
    try { return { ok: true, json: JSON.parse(res.text.replace(/^﻿/, "")) as Json }; }   // Authorize.net prefixes a byte order mark
    catch { return { ok: false, failure: failure("provider_error") }; }
  }

  private async transaction(transactionRequest: Json, key: string): Promise<{ ok: true; tx: Tx; msg: Messages } | { ok: false; failure: PaymentFailure }> {
    const c = await this.call({ createTransactionRequest: { merchantAuthentication: this.auth(), refId: refId(key), transactionRequest } });
    if (!c.ok) return c;
    const tx = (c.json.transactionResponse ?? {}) as Tx;
    const msg = (c.json.messages ?? {}) as Messages;
    const msgCode = safeCode(msg.message?.[0]?.code);
    // E00114/E00115: the Accept.js token is invalid or expired.
    if (msgCode === "E00114" || msgCode === "E00115") return { ok: false, failure: failure("invalid_token", msgCode) };
    return { ok: true, tx, msg };
  }

  private outcome(tx: Tx, msg: Messages): PaymentFailure | null {
    if (String(tx.responseCode) === "1" && typeof tx.transId === "string" && tx.transId !== "0" && msg.resultCode === "Ok") return null;
    const code = safeCode(tx.errors?.[0]?.errorCode) ?? safeCode(msg.message?.[0]?.code);
    return String(tx.responseCode) === "2" ? failure("declined", code) : failure("provider_error", String(tx.responseCode) === "4" ? "held_for_review" : code);
  }

  async authorize(r: AuthorizeRequest): Promise<AuthorizeResult> {
    const dataValue = decodeAnetToken(r.token);
    if (!dataValue) return failure("invalid_token");
    const t = await this.transaction({
      transactionType: "authOnlyTransaction", amount: dollars(r.amountCents),
      payment: { opaqueData: { dataDescriptor: ANET_DESCRIPTOR, dataValue } },
      ...(r.description ? { order: { description: r.description.slice(0, 255) } } : {}),
      // Our own one-payment-per-order guard prevents double charges, so Authorize.net's duplicate window is off.
      transactionSettings: { setting: [{ settingName: "duplicateWindow", settingValue: "0" }] },
    }, r.idempotencyKey);
    if (!t.ok) return t.failure;
    return this.outcome(t.tx, t.msg) ?? { ok: true, reference: t.tx.transId as string, amountCents: r.amountCents };
  }

  async capture(r: CaptureRequest): Promise<CaptureResult> {
    const t = await this.transaction({ transactionType: "priorAuthCaptureTransaction", amount: dollars(r.amountCents), refTransId: r.reference }, r.idempotencyKey);
    if (!t.ok) return t.failure;
    return this.outcome(t.tx, t.msg) ?? { ok: true, reference: t.tx.transId as string };
  }

  async void(r: VoidRequest): Promise<VoidResult> {
    const t = await this.transaction({ transactionType: "voidTransaction", refTransId: r.reference }, r.idempotencyKey);
    if (!t.ok) return t.failure;
    return this.outcome(t.tx, t.msg) ?? { ok: true };
  }

  /**
   * Authorize.net can only refund a SETTLED charge (usually the next day) and needs the card's last four digits.
   * An unsettled charge refunded in full is voided instead; a partial refund of an unsettled charge is refused until it settles.
   */
  async refund(r: RefundRequest): Promise<RefundResult> {
    const d = await this.call({ getTransactionDetailsRequest: { merchantAuthentication: this.auth(), transId: r.reference } });
    if (!d.ok) return d.failure;
    const tr = d.json.transaction as Json | undefined;
    if ((d.json.messages as Messages | undefined)?.resultCode !== "Ok" || !tr) return failure("provider_error");
    const status = String(tr.transactionStatus ?? "");
    if (status === "capturedPendingSettlement") {
      if (toCents(tr.authAmount) !== r.amountCents) return failure("provider_error", "unsettled_partial_refund");
      const v = await this.transaction({ transactionType: "voidTransaction", refTransId: r.reference }, r.idempotencyKey);
      if (!v.ok) return v.failure;
      return this.outcome(v.tx, v.msg) ?? { ok: true, reference: v.tx.transId as string };
    }
    if (status !== "settledSuccessfully") return failure("provider_error", "not_refundable");
    const last4 = String(((tr.payment as Json | undefined)?.creditCard as Json | undefined)?.cardNumber ?? "").replace(/\D/g, "").slice(-4);
    if (last4.length !== 4) return failure("provider_error", "no_card_reference");
    const t = await this.transaction({
      transactionType: "refundTransaction", amount: dollars(r.amountCents), refTransId: r.reference,
      payment: { creditCard: { cardNumber: last4, expirationDate: "XXXX" } },
    }, r.idempotencyKey);
    if (!t.ok) return t.failure;
    return this.outcome(t.tx, t.msg) ?? { ok: true, reference: t.tx.transId as string };
  }

  /** Authorize.net signs the raw body: `X-ANET-Signature: sha512=<HEX>` = HMAC-SHA512(signature key, body). */
  async verifyWebhook(raw: string, headers: { get(name: string): string | null }): Promise<WebhookVerification> {
    const key = this.cfg.signatureKey;
    if (key.length < 16) return { ok: false, reason: "not_configured" };
    const given = (headers.get(ANET_SIGNATURE_HEADER) ?? "").trim().replace(/^sha512=/i, "").toLowerCase();
    if (!/^[0-9a-f]{128}$/.test(given)) return { ok: false, reason: "bad_signature" };
    // The docs are ambiguous on whether the key is used as plain text or hex-decoded: accept either (both need the secret).
    const keys: (string | Buffer)[] = [key];
    if (/^(?:[0-9a-fA-F]{2})+$/.test(key)) keys.push(Buffer.from(key, "hex"));
    const good = keys.some((k) => { const want = createHmac("sha512", k).update(raw, "utf8").digest("hex"); return timingSafeEqual(Buffer.from(want), Buffer.from(given)); });
    if (!good) return { ok: false, reason: "bad_signature" };
    try {
      const j = JSON.parse(raw) as { notificationId?: unknown; eventType?: unknown; payload?: { id?: unknown; authAmount?: unknown } };
      if (typeof j.notificationId !== "string" || !j.notificationId || j.notificationId.length > 200) return { ok: false, reason: "bad_payload" };
      const et = String(j.eventType ?? "");
      const type: PaymentEvent["type"] = /payment\.(authcapture|capture|priorauthcapture)\.created$/.test(et) ? "charge.captured"
        : /payment\.void\.created$/.test(et) ? "charge.voided" : /payment\.refund\.created$/.test(et) ? "charge.refunded" : "unknown";
      const id = j.payload?.id === undefined ? undefined : String(j.payload.id).slice(0, 100);
      const amount = toCents(j.payload?.authAmount);
      // For a refund event the payload id is the refund's own transaction id; the original charge is not in the payload.
      const ev: PaymentEvent = { id: j.notificationId, type, ...(type === "charge.refunded" ? { refundRef: id } : { chargeRef: id }), ...(Number.isInteger(amount) ? { amountCents: amount } : {}) };
      return { ok: true, events: [ev] };
    } catch { return { ok: false, reason: "bad_payload" }; }
  }
}

export const signAuthorizeNetWebhook = (key: string | Buffer, body: string) => `sha512=${createHmac("sha512", key).update(body, "utf8").digest("hex").toUpperCase()}`;
