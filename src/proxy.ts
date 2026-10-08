import { NextResponse, type NextRequest } from "next/server";
import { AGE_COOKIE, verifyAgeToken } from "@/lib/domain/age-gate";

/** 21+ site-entry gate. Fails closed when the secret is missing or the cookie is invalid. */
export async function proxy(req: NextRequest) {
  const ok = await verifyAgeToken(process.env.AGE_GATE_SECRET, req.cookies.get(AGE_COOKIE)?.value, Math.floor(Date.now() / 1000));
  if (ok) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/age-gate";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the gate itself, static assets and crawler files.
  matcher: ["/((?!age-gate|admin|api/cron|api/webhooks|_next/|images/|favicon.ico|robots.txt).*)"],
};
