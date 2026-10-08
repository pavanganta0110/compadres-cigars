import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/payments/quickbooks/oauth";
import { QB_STATE_COOKIE, quickbooksConfigFromEnv, quickbooksConfigured } from "@/lib/payments/quickbooks/config";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

/** Owner-only. Sends the owner to Intuit's consent screen with a one-time state value (CSRF protection). */
export async function GET(req: Request) {
  await requireStaff("manage_payments");
  const cfg = quickbooksConfigFromEnv(process.env);
  if (!quickbooksConfigured(cfg)) return NextResponse.redirect(new URL("/admin/payments?qb=not_configured", req.url));
  const state = crypto.randomUUID();
  (await cookies()).set(QB_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", path: "/admin/payments", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return NextResponse.redirect(authorizeUrl(cfg, state));
}
