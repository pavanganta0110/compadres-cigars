/** Email providers sit behind this interface. Relative imports only. */
export type EmailKind = "order_confirmation" | "order_shipped" | "refund_issued" | "admin_new_order" | "admin_low_stock" | "admin_needs_review" | "admin_test";

export type OutgoingEmail = { to: string; subject: string; html: string; text: string; idempotencyKey: string; replyTo?: string };
/** retryable: a later attempt may succeed (network, 429, 5xx). Not retryable: bad address, rejected content, bad key. */
export type SendResult = { ok: true; id: string } | { ok: false; retryable: boolean; code: string };

export interface EmailProvider {
  readonly name: "mock" | "resend" | "none";
  send(e: OutgoingEmail): Promise<SendResult>;
}

export class UnavailableEmailProvider implements EmailProvider {
  readonly name = "none" as const;
  async send(): Promise<SendResult> { return { ok: false, retryable: false, code: "unavailable" }; }
}
