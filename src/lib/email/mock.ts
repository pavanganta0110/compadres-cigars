import type { EmailProvider, OutgoingEmail, SendResult } from "./types";

/** Local/CI only (refused in production by the gate). Sends nothing; accepts every well-formed address. */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock" as const;
  async send(e: OutgoingEmail): Promise<SendResult> {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.to)) return { ok: false, retryable: false, code: "bad_address" };
    return { ok: true, id: `mock_${e.idempotencyKey.replace(/[^A-Za-z0-9]/g, "").slice(-24)}` };
  }
}
