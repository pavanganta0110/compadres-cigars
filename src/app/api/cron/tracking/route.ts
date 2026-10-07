import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshTracking } from "@/lib/server/tracking-sync";

export const dynamic = "force-dynamic";

/** Hourly (see vercel.json). Requires CRON_SECRET; with no secret configured it refuses every request. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await refreshTracking());
}
