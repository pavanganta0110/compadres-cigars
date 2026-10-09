import type { EmailProvider, OutgoingEmail, SendResult } from "./types";

export type HttpRequest = { method: "POST"; url: string; headers: Record<string, string>; body: string };
export type HttpResponse = { status: number; text: string };
export type Transport = (r: HttpRequest) => Promise<HttpResponse>;
export const fetchTransport: Transport = async (r) => {
  const res = await fetch(r.url, { method: r.method, headers: r.headers, body: r.body, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  return { status: res.status, text: await res.text() };
};

export const RESEND_URL = "https://api.resend.com/emails";

/** Resend REST API. The API key is only ever placed in the Authorization header; provider error text is never copied anywhere. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  constructor(private apiKey: string, private from: string, private http: Transport = fetchTransport) {}
  async send(e: OutgoingEmail): Promise<SendResult> {
    let res: HttpResponse;
    try {
      res = await this.http({
        method: "POST", url: RESEND_URL,
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": e.idempotencyKey.slice(0, 250) },
        body: JSON.stringify({ from: this.from, to: [e.to], subject: e.subject, html: e.html, text: e.text, ...(e.replyTo ? { reply_to: e.replyTo } : {}) }),
      });
    } catch { return { ok: false, retryable: true, code: "network" }; }
    let j: { id?: unknown; name?: unknown } = {};
    try { j = JSON.parse(res.text) as typeof j; } catch { /* not JSON */ }
    if (res.status >= 200 && res.status < 300 && typeof j.id === "string") return { ok: true, id: j.id };
    const code = typeof j.name === "string" && /^[a-z_]{1,60}$/.test(j.name) ? j.name : `http_${res.status}`;
    return { ok: false, retryable: res.status === 429 || res.status >= 500 || res.status === 409, code };
  }
}

export const fromAddressOk = (v: string) => /^(?:[^<>@\r\n]{1,80} )?<?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(v.trim());
