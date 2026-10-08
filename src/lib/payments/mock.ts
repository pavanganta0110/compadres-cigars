import { createHmac, timingSafeEqual } from "node:crypto";
import { MOCK_TOKEN_PREFIX } from "./token";
import type { AuthorizeRequest, CaptureRequest, PaymentEvent, PaymentFailure, PaymentProvider, RefundRequest, VoidRequest, WebhookVerification } from "./types";

export const MOCK_SIGNATURE_HEADER = "x-compadres-signature";
const stable = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").slice(-24);

/**
 * Local/staging only (the factory refuses it in production). Deterministic from the idempotency key, so a retried
 * request returns the same reference. Test cards: 4242 4242 4242 4242 approves, 4000 0000 0000 0002 declines.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;
  readonly mode = "mock" as const;
  constructor(private webhookSecret: string = "") {}

  async authorize(r: AuthorizeRequest) {
    if (!Number.isInteger(r.amountCents) || r.amountCents <= 0) return { ok: false, code: "provider_error", message: "Invalid amount." } as PaymentFailure;
    if (r.token.startsWith(`${MOCK_TOKEN_PREFIX}approve_`)) return { ok: true as const, reference: `mock_auth_${stable(r.idempotencyKey)}`, amountCents: r.amountCents };
    if (r.token.startsWith(`${MOCK_TOKEN_PREFIX}decline_`)) return { ok: false, code: "declined", message: "The card was declined.", providerCode: "mock_decline" } as PaymentFailure;
    return { ok: false, code: "invalid_token", message: "The card details could not be used." } as PaymentFailure;
  }
  async capture(r: CaptureRequest) {
    return r.reference.startsWith("mock_auth_") ? { ok: true as const, reference: `mock_ch_${r.reference.slice("mock_auth_".length)}` } : { ok: false, code: "provider_error", message: "Unknown authorization." } as PaymentFailure;
  }
  async void(r: VoidRequest) {
    return r.reference.startsWith("mock_auth_") ? { ok: true as const } : { ok: false, code: "provider_error", message: "Unknown authorization." } as PaymentFailure;
  }
  async refund(r: RefundRequest) {
    if (!r.reference.startsWith("mock_ch_") || !Number.isInteger(r.amountCents) || r.amountCents <= 0) return { ok: false, code: "provider_error", message: "Refund could not be processed." } as PaymentFailure;
    return { ok: true as const, reference: `mock_rf_${stable(r.idempotencyKey)}` };
  }

  async verifyWebhook(rawBody: string, headers: { get(name: string): string | null }): Promise<WebhookVerification> {
    if (this.webhookSecret.length < 16) return { ok: false, reason: "not_configured" };
    const given = headers.get(MOCK_SIGNATURE_HEADER) ?? "";
    const want = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    if (given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) return { ok: false, reason: "bad_signature" };
    try {
      const j = JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof j.id !== "string" || !j.id || j.id.length > 200) return { ok: false, reason: "bad_payload" };
      const types = ["charge.captured", "charge.declined", "charge.voided", "charge.refunded"];
      const ev: PaymentEvent = {
        id: j.id, type: types.includes(String(j.type)) ? (j.type as PaymentEvent["type"]) : "unknown",
        chargeRef: typeof j.chargeRef === "string" ? j.chargeRef : undefined, refundRef: typeof j.refundRef === "string" ? j.refundRef : undefined,
        amountCents: Number.isInteger(j.amountCents) ? (j.amountCents as number) : undefined,
      };
      return { ok: true, events: [ev] };
    } catch { return { ok: false, reason: "bad_payload" }; }
  }
}

export const signMockWebhook = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("hex");
