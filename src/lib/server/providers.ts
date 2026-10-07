import "server-only";
import { SelfAttestationProvider, type AgeVerificationProvider } from "@/lib/domain/age";
import { MockShippingProvider, UnavailableShippingProvider, type ShippingProvider } from "@/lib/domain/shipping";
import { mockAllowed, providerMode, type ProviderMode } from "@/lib/domain/providers";
import { fedexConfigFromEnv, isConfigured } from "@/lib/shipping/fedex/config";
import { FedExShippingProvider } from "@/lib/shipping/fedex/provider";

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
