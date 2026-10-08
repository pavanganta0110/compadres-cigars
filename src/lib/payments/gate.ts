import { mockAllowed, providerMode, type ProviderMode } from "../domain/providers";
import type { PaymentMode } from "./types";

export type PaymentSelection =
  | { kind: "mock"; mode: "mock" }
  | { kind: "quickbooks"; mode: "sandbox" | "live" }
  | { kind: "unavailable"; mode: "disabled"; reason: string };

/**
 * Which processor is in play, from env alone (pure). Rules:
 *  - COMPADRES_PAYMENT_PROVIDER=quickbooks selects QuickBooks. Not configured => UNAVAILABLE, never mocked.
 *  - Live ONLY if APP_ENV=production AND COMPADRES_PAYMENT_PRODUCTION_APPROVED=true. Otherwise Intuit's sandbox.
 *  - mock (or unset) is the local/staging mock and is refused when APP_ENV=production.
 */
export function selectPayment(opts: { appEnv: string | undefined; provider: string | undefined; approved: string | undefined; quickbooksConfigured: boolean }): PaymentSelection {
  const p = (opts.provider ?? "").trim().toLowerCase();
  if (p === "quickbooks") {
    if (!opts.quickbooksConfigured) return { kind: "unavailable", mode: "disabled", reason: "QuickBooks Payments is selected but not configured." };
    const m = providerMode({ appEnv: opts.appEnv, configured: true, approved: opts.approved });
    return { kind: "quickbooks", mode: m === "live" ? "live" : "sandbox" };
  }
  if (p === "" || p === "mock") {
    return mockAllowed(opts.appEnv) ? { kind: "mock", mode: "mock" } : { kind: "unavailable", mode: "disabled", reason: "The mock payment provider is refused in production." };
  }
  return { kind: "unavailable", mode: "disabled", reason: "Unknown payment provider." };
}

export const toProviderMode = (m: PaymentMode): ProviderMode => (m === "live" ? "live" : "sandbox");
