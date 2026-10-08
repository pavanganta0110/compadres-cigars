import "server-only";
import { SelfAttestationProvider, type AgeVerificationProvider } from "@/lib/domain/age";
import { MockShippingProvider, UnavailableShippingProvider, type ShippingProvider } from "@/lib/domain/shipping";
import { mockAllowed, providerMode, type ProviderMode } from "@/lib/domain/providers";
import { fedexConfigFromEnv, isConfigured } from "@/lib/shipping/fedex/config";
import { FedExShippingProvider } from "@/lib/shipping/fedex/provider";
import { selectPayment } from "@/lib/payments/gate";
import { MockPaymentProvider } from "@/lib/payments/mock";
import { fetchTransport } from "@/lib/payments/quickbooks/transport";
import { quickbooksConfigFromEnv, quickbooksConfigured, quickbooksTokenizeUrl } from "@/lib/payments/quickbooks/config";
import { QuickBooksOAuth } from "@/lib/payments/quickbooks/oauth";
import { QuickBooksPaymentsProvider } from "@/lib/payments/quickbooks/provider";
import { UnavailablePaymentProvider, type PaymentMode, type PaymentProvider } from "@/lib/payments/types";
import { DbTokenStore } from "./payment-credentials";

export function ageProvider(): { provider: AgeVerificationProvider; mode: ProviderMode } {
  // Only self-attestation exists today. An ID vendor implements AgeVerificationProvider and is selected here.
  return { provider: new SelfAttestationProvider(), mode: "sandbox" };
}

/**
 * COMPADRES_SHIPPING_PROVIDER=fedex selects FedEx. If it is requested but not configured/approved, shipping is
 * UNAVAILABLE (never silently mocked). Unset: mock rates, refused in production.
 */
export function shippingProvider(): { provider: ShippingProvider; mode: ProviderMode; name: string } {
  const env = process.env;
  if (env.COMPADRES_SHIPPING_PROVIDER === "fedex") {
    const cfg = fedexConfigFromEnv(env);
    if (!isConfigured(cfg)) return { provider: new UnavailableShippingProvider(), mode: "disabled", name: "fedex (not configured)" };
    const mode = providerMode({ appEnv: env.APP_ENV, configured: true, approved: env.COMPADRES_SHIPPING_PRODUCTION_APPROVED });
    return { provider: new FedExShippingProvider(cfg) as ShippingProvider, mode, name: "fedex" };
  }
  if (!mockAllowed(env.APP_ENV)) return { provider: new UnavailableShippingProvider(), mode: "disabled", name: "none" };
  return { provider: new MockShippingProvider(), mode: "sandbox", name: "mock" };
}

// ---------------------------------------------------------------- payments
/** What the browser needs to turn a card into a token. Public values only. */
export type Tokenizer = { kind: "mock" } | { kind: "quickbooks"; url: string };

export type PaymentSetup = {
  provider: PaymentProvider;
  /** disabled | sandbox (mock or Intuit sandbox) | live */
  mode: "disabled" | "sandbox" | "live";
  paymentMode: PaymentMode | "disabled";
  name: string;
  /** OAuth connected (QuickBooks). null for the mock, which has nothing to connect. */
  connected: boolean | null;
  /** Live gates satisfied AND connected. This is NOT a statement that the processor has approved tobacco sales. */
  productionReady: boolean;
  detail: string;
  /** null when the checkout cannot take a payment right now. */
  tokenizer: Tokenizer | null;
};

/**
 * COMPADRES_PAYMENT_PROVIDER=quickbooks selects Intuit; not configured => UNAVAILABLE, never silently mocked.
 * Live only if APP_ENV=production AND COMPADRES_PAYMENT_PRODUCTION_APPROVED=true. Unset/mock => mock, refused in production.
 */
export async function paymentSetup(): Promise<PaymentSetup> {
  const env = process.env;
  const qb = quickbooksConfigFromEnv(env);
  const sel = selectPayment({ appEnv: env.APP_ENV, provider: env.COMPADRES_PAYMENT_PROVIDER, approved: env.COMPADRES_PAYMENT_PRODUCTION_APPROVED, quickbooksConfigured: quickbooksConfigured(qb) });
  if (sel.kind === "unavailable") {
    return { provider: new UnavailablePaymentProvider(), mode: "disabled", paymentMode: "disabled", name: "none", connected: null, productionReady: false, detail: `Unavailable: ${sel.reason} Checkout cannot take payments.`, tokenizer: null };
  }
  if (sel.kind === "mock") {
    return {
      provider: new MockPaymentProvider(env.COMPADRES_PAYMENT_WEBHOOK_SECRET ?? ""), mode: "sandbox", paymentMode: "mock", name: "mock", connected: null,
      productionReady: false, detail: "Mock processor (local/staging only). No card is ever charged.", tokenizer: { kind: "mock" },
    };
  }
  const store = new DbTokenStore(qb.encryptionKey);
  const connected = (await store.load()) !== null;
  const provider = new QuickBooksPaymentsProvider(sel.mode, new QuickBooksOAuth(qb, store, fetchTransport), fetchTransport, qb.webhookVerifier);
  return {
    provider, mode: sel.mode, paymentMode: sel.mode, name: "quickbooks", connected, productionReady: sel.mode === "live" && connected,
    detail: sel.mode === "live" ? "QuickBooks Payments, LIVE gates satisfied." : "QuickBooks Payments, Intuit sandbox (no real money).",
    tokenizer: connected ? { kind: "quickbooks", url: quickbooksTokenizeUrl(sel.mode) } : null,
  };
}
