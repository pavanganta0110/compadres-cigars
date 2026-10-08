import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchTransport } from "@/lib/payments/quickbooks/transport";
import { QB_STATE_COOKIE, quickbooksConfigFromEnv, quickbooksConfigured } from "@/lib/payments/quickbooks/config";
import { QuickBooksOAuth } from "@/lib/payments/quickbooks/oauth";
import { DbTokenStore } from "@/lib/server/payment-credentials";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

/** Intuit redirects here with ?code&state. The state must match the cookie set by /connect. Tokens are stored encrypted. */
export async function GET(req: Request) {
  const staff = await requireStaff("manage_payments");
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/payments?qb=${q}`, req.url));
  const jar = await cookies();
  const expected = jar.get(QB_STATE_COOKIE)?.value ?? "";
  jar.delete(QB_STATE_COOKIE);
  const given = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return back("bad_state");
  if (url.searchParams.get("error") || !code) return back("denied");
  const cfg = quickbooksConfigFromEnv(process.env);
  if (!quickbooksConfigured(cfg)) return back("not_configured");
  try {
    await new QuickBooksOAuth(cfg, new DbTokenStore(cfg.encryptionKey), fetchTransport).exchangeCode(code);
  } catch {
    await auditAdmin(staff.id, "payments.quickbooks_connect_failed", "payments", null, {});
    return back("failed");
  }
  await auditAdmin(staff.id, "payments.quickbooks_connected", "payments", null, {});
  return back("connected");
}
