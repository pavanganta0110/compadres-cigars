import { mockAllowed } from "../domain/providers";

export type EmailMode = "disabled" | "mock" | "sandbox" | "live";
export type EmailSelection = { kind: "mock"; mode: "mock" } | { kind: "resend"; mode: "sandbox" | "live" } | { kind: "unavailable"; mode: "disabled"; reason: string };

/**
 * resend selected but not configured => UNAVAILABLE (never silently mocked). Real email goes to customers ONLY when
 * APP_ENV=production AND COMPADRES_EMAIL_PRODUCTION_APPROVED=true ("live"); otherwise "sandbox" sends only to an allowlist.
 * mock (or unset) is refused in production.
 */
export function selectEmail(o: { appEnv: string | undefined; provider: string | undefined; approved: string | undefined; resendConfigured: boolean }): EmailSelection {
  const p = (o.provider ?? "").trim().toLowerCase();
  if (p === "resend") {
    if (!o.resendConfigured) return { kind: "unavailable", mode: "disabled", reason: "Resend is selected but not configured (API key and From address)." };
    return { kind: "resend", mode: o.appEnv === "production" && o.approved === "true" ? "live" : "sandbox" };
  }
  if (p === "" || p === "mock") return mockAllowed(o.appEnv) ? { kind: "mock", mode: "mock" } : { kind: "unavailable", mode: "disabled", reason: "No email provider is configured, and the mock is refused in production." };
  return { kind: "unavailable", mode: "disabled", reason: "Unknown email provider." };
}

export const parseList = (v: string | undefined): string[] =>
  [...new Set((v ?? "").split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))];

/** Outside live mode only allowlisted recipients (staff addresses and COMPADRES_EMAIL_TEST_ALLOWLIST) may receive real email. */
export function recipientAllowed(mode: EmailMode, to: string, allow: string[]): boolean {
  if (mode === "live" || mode === "mock") return true;
  return allow.includes(to.trim().toLowerCase());
}
