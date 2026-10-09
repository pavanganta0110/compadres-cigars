import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processOutbox } from "@/lib/server/email-service";

export const dynamic = "force-dynamic";

/** Daily safety net (see vercel.json): retries emails that failed earlier. Requires CRON_SECRET; refuses everything without it. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await processOutbox(50));
}
