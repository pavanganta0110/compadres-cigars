/**
 * Payment processors sit behind this interface. Card data NEVER reaches this code: the browser sends the card
 * straight to the processor's tokenization endpoint and our server only ever sees the opaque, single-use token.
 * Relative imports only so the files stay loadable from scripts and tests.
 */
export type PaymentMode = "mock" | "sandbox" | "live";

export type PaymentFailureCode = "declined" | "invalid_token" | "provider_error" | "unavailable";
/** `message` is safe to show customers and staff. It never contains processor payloads or secrets. */
export type PaymentFailure = { ok: false; code: PaymentFailureCode; message: string; providerCode?: string };

export type AuthorizeRequest = { amountCents: number; token: string; idempotencyKey: string; description?: string };
export type AuthorizeResult = { ok: true; reference: string; amountCents: number } | PaymentFailure;
export type CaptureRequest = { reference: string; amountCents: number; idempotencyKey: string };
export type CaptureResult = { ok: true; reference: string } | PaymentFailure;
/** Void an authorization that was never captured. */
export type VoidRequest = { reference: string; amountCents: number; idempotencyKey: string };
export type VoidResult = { ok: true } | PaymentFailure;
/** `reference` is the captured charge's reference. */
export type RefundRequest = { reference: string; amountCents: number; idempotencyKey: string; reason?: string };
export type RefundResult = { ok: true; reference: string } | PaymentFailure;

export type PaymentEventType = "charge.captured" | "charge.declined" | "charge.voided" | "charge.refunded" | "unknown";
export type PaymentEvent = {
  id: string; type: PaymentEventType;
  /** Processor reference of the charge the event is about, when known. */
  chargeRef?: string; refundRef?: string; amountCents?: number;
};
export type WebhookVerification = { ok: true; events: PaymentEvent[] } | { ok: false; reason: "bad_signature" | "bad_payload" | "not_configured" };

export interface PaymentProvider {
  readonly name: "mock" | "quickbooks" | "none";
  readonly mode: PaymentMode;
  authorize(req: AuthorizeRequest): Promise<AuthorizeResult>;
  capture(req: CaptureRequest): Promise<CaptureResult>;
  void(req: VoidRequest): Promise<VoidResult>;
  refund(req: RefundRequest): Promise<RefundResult>;
  /** Verifies the signature over the RAW body first, and only then parses it. Fails closed. */
  verifyWebhook(rawBody: string, headers: { get(name: string): string | null }): Promise<WebhookVerification>;
}

/** A placeholder used when payments are unavailable. Every call fails; nothing is ever mocked silently. */
export class UnavailablePaymentProvider implements PaymentProvider {
  readonly name = "none" as const;
  readonly mode = "mock" as const;
  private fail(): Promise<PaymentFailure> { return Promise.resolve({ ok: false, code: "unavailable", message: "Payments are not available." }); }
  authorize(): Promise<AuthorizeResult> { return this.fail(); }
  capture(): Promise<CaptureResult> { return this.fail(); }
  void(): Promise<VoidResult> { return this.fail(); }
  refund(): Promise<RefundResult> { return this.fail(); }
  async verifyWebhook(): Promise<WebhookVerification> { return { ok: false, reason: "not_configured" }; }
}
