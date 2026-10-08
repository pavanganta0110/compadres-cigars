import { NextResponse } from "next/server";
import { paymentSetup } from "@/lib/server/providers";
import { processEvents } from "@/lib/server/webhook-service";

export const dynamic = "force-dynamic";
const MAX_BODY = 256 * 1024;

/**
 * Processor webhooks. Signature is verified over the RAW body before anything is parsed or stored; any failure is a
 * 401 and writes nothing. Each event id is processed once (replays are acknowledged and ignored).
 * Mock: HMAC-SHA256 hex in `x-compadres-signature`. QuickBooks: base64 HMAC in `intuit-signature`.
 */
export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const setup = await paymentSetup();
  const v = await setup.provider.verifyWebhook(raw, req.headers);
  if (!v.ok) {
    console.warn(`payment webhook rejected: ${v.reason}`);
    return NextResponse.json({ error: v.reason }, { status: v.reason === "not_configured" ? 503 : v.reason === "bad_payload" ? 400 : 401 });
  }
  try {
    const out = await processEvents(setup.name, v.events);
    return NextResponse.json({ ok: true, ...out });
  } catch {
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });   // processor will retry; the claim was released
  }
}
