import "server-only";
import { SelfAttestationProvider, type AgeVerificationProvider } from "@/lib/domain/age";
import { MockShippingProvider, type ShippingProvider } from "@/lib/domain/shipping";
import { mockAllowed, providerMode, type ProviderMode } from "@/lib/domain/providers";

export function ageProvider(): { provider: AgeVerificationProvider; mode: ProviderMode } {
  // Only self-attestation exists today. An ID vendor implements AgeVerificationProvider and is selected here.
  return { provider: new SelfAttestationProvider(), mode: "sandbox" };
}

export function shippingProvider(): { provider: ShippingProvider; mode: ProviderMode } {
  const env = process.env;
  const mode = providerMode({ appEnv: env.APP_ENV, configured: Boolean(env.COMPADRES_SHIPPING_PROVIDER), approved: env.COMPADRES_SHIPPING_PRODUCTION_APPROVED });
  if (!mockAllowed(env.APP_ENV)) throw new Error("No live shipping provider is configured; mock shipping is refused in production");
  return { provider: new MockShippingProvider(), mode: "sandbox" === mode || mode === "disabled" ? "sandbox" : mode };
}
