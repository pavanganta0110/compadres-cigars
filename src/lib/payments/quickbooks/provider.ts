import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { quickbooksApiBase } from "./config";
import { NotConnectedError, type QuickBooksOAuth } from "./oauth";
import type { Transport } from "./transport";
import type {
  AuthorizeRequest, AuthorizeResult, CaptureRequest, CaptureResult, PaymentEvent, PaymentFailure, PaymentProvider,
  RefundRequest, RefundResult, VoidRequest, VoidResult, WebhookVerification,
} from "../types";

export const QB_SIGNATURE_HEADER = "intuit-signature";
const CONTEXT = { mobile: false, isEcommerce: true };
const dollars = (cents: number) => (cents / 100).toFixed(2);
const toCents = (v: unknown) => (typeof v === "string" || typeof v === "number") && Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : NaN;

const FAIL = {
  declined: { code: "declined", message: "The card was declined." },
  invalid_token: { code: "invalid_token", message: "The card details could not be used." },
  provider_error: { code: "provider_error", message: "The payment processor could not complete the request." },
  unavailable: { code: "unavailable", message: "Payments are not connected." },
} as const;
const failure = (k: keyof typeof FAIL, providerCode?: string): PaymentFailure => ({ ok: false, ...FAIL[k], ...(providerCode ? { providerCode } : {}) });

type Json = Record<string, unknown>;
type Call = { ok: true; status: number; json: Json } | { ok: false; failure: PaymentFailure };

/**
 * Intuit Payments API (sandbox first). The card token comes from the browser; this class never sees card data.
 * Processor error text is NEVER copied into messages (only a sanitized error code), so nothing sensitive is echoed or logged.
 * NOTE: request/response shapes follow Intuit's public Payments API reference and are covered by fake-transport tests;
 * they have NOT been exercised against Intuit's sandbox from this codebase yet.
 */
export class QuickBooksPaymentsProvider implements PaymentProvider {
  readonly name = "quickbooks" as const;
  constructor(readonly mode: "sandbox" | "live", private oauth: QuickBooksOAuth, private http: Transport, private webhookVerifier: string) {}

  private async call(path: string, body: Json, requestId: string): Promise<Call> {
    const url = `${quickbooksApiBase(this.mode)}/quickbooks/v4/payments${path}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      let token: string;
      try { token = await this.oauth.accessToken(); } catch (e) { return { ok: false, failure: e instanceof NotConnectedError ? failure("unavailable") : failure("provider_error") }; }
      let res;
      try {
        res = await this.http({ method: "POST", url, body: JSON.stringify(body), headers: { Authorization: `Bearer ${token}`, "Request-Id": requestId, "Content-Type": "application/json", Accept: "application/json" } });
      } catch { return { ok: false, failure: failure("provider_error") }; }
      if (res.status === 401 && attempt === 0) { this.oauth.invalidate(); continue; }
      let json: Json = {};
      try { json = JSON.parse(res.text) as Json; } catch { /* not JSON */ }
      if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status, json };
      const first = Array.isArray(json.errors) ? (json.errors[0] as Json | undefined) : undefined;
      const code = typeof first?.code === "string" && /^[\w.-]{1,40}$/.test(first.code) ? first.code : undefined;
      const text = `${first?.message ?? ""} ${first?.detail ?? ""}`.toLowerCase();
      if (res.status === 400 && /token/.test(text)) return { ok: false, failure: failure("invalid_token", code) };
      return { ok: false, failure: failure("provider_error", code) };
    }
    return { ok: false, failure: failure("provider_error") };
  }

  async authorize(r: AuthorizeRequest): Promise<AuthorizeResult> {
    const c = await this.call("/charges", { amount: dollars(r.amountCents), currency: "USD", token: r.token, capture: false, context: CONTEXT, ...(r.description ? { description: r.description.slice(0, 100) } : {}) }, r.idempotencyKey);
    if (!c.ok) return c.failure;
    const status = String(c.json.status ?? "").toUpperCase();
    if (status === "DECLINED") return failure("declined", typeof c.json.code === "string" ? c.json.code.slice(0, 40) : undefined);
    if (status !== "AUTHORIZED" || typeof c.json.id !== "string" || !c.json.id) return failure("provider_error");
    if (c.json.amount !== undefined && toCents(c.json.amount) !== r.amountCents) return failure("provider_error", "amount_mismatch");
    return { ok: true, reference: c.json.id, amountCents: r.amountCents };
  }

  async capture(r: CaptureRequest): Promise<CaptureResult> {
    const c = await this.call(`/charges/${encodeURIComponent(r.reference)}/capture`, { amount: dollars(r.amountCents), context: CONTEXT }, r.idempotencyKey);
    if (!c.ok) return c.failure;
    if (String(c.json.status ?? "").toUpperCase() !== "CAPTURED" || typeof c.json.id !== "string") return failure("provider_error");
    return { ok: true, reference: c.json.id };
  }

  /** Reverses an uncaptured authorization. Intuit has no separate card "void": a refund on the charge releases the hold (verify in sandbox). */
  async void(r: VoidRequest): Promise<VoidResult> {
    const c = await this.call(`/charges/${encodeURIComponent(r.reference)}/refunds`, { amount: dollars(r.amountCents), context: CONTEXT }, r.idempotencyKey);
    return c.ok ? { ok: true } : c.failure;
  }

  async refund(r: RefundRequest): Promise<RefundResult> {
    const c = await this.call(`/charges/${encodeURIComponent(r.reference)}/refunds`, { amount: dollars(r.amountCents), description: (r.reason ?? "Refund").slice(0, 100), context: CONTEXT }, r.idempotencyKey);
    if (!c.ok) return c.failure;
    if (typeof c.json.id !== "string" || !c.json.id) return failure("provider_error");
    const st = String(c.json.status ?? "").toUpperCase();
    if (st && !["ISSUED", "SETTLED", "PENDING"].includes(st)) return failure("provider_error");
    return { ok: true, reference: c.json.id };
  }

  /** Intuit signs the raw body: base64(HMAC-SHA256(verifier token, body)) in `intuit-signature`. */
  async verifyWebhook(raw: string, headers: { get(name: string): string | null }): Promise<WebhookVerification> {
    if (this.webhookVerifier.length < 8) return { ok: false, reason: "not_configured" };
    const given = headers.get(QB_SIGNATURE_HEADER) ?? "";
    const want = createHmac("sha256", this.webhookVerifier).update(raw).digest("base64");
    if (given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) return { ok: false, reason: "bad_signature" };
    try {
      const j = JSON.parse(raw) as { eventNotifications?: { realmId?: string; dataChangeEvent?: { entities?: { name?: string; id?: string; operation?: string; lastUpdated?: string }[] } }[] };
      if (!Array.isArray(j.eventNotifications)) return { ok: false, reason: "bad_payload" };
      const events: PaymentEvent[] = [];
      for (const n of j.eventNotifications) for (const e of n.dataChangeEvent?.entities ?? []) {
        if (events.length >= 100) break;
        const id = createHash("sha256").update([n.realmId, e.name, e.id, e.operation, e.lastUpdated].join("|")).digest("hex");
        events.push({ id, type: "unknown", chargeRef: typeof e.id === "string" ? e.id.slice(0, 100) : undefined });
      }
      return { ok: true, events };
    } catch { return { ok: false, reason: "bad_payload" }; }
  }
}

export const signQuickBooksWebhook = (verifier: string, body: string) => createHmac("sha256", verifier).update(body).digest("base64");
