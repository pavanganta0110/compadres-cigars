export type ShippingRate = { service: string; label: string; cents: number; adultSignature: boolean };

export interface ShippingProvider {
  readonly name: string;
  /** Server-computed rates only. The browser can choose among them but never supply one. */
  rates(ctx: { state: string; postalCode: string; totalUnits: number; weightOz: number }): Promise<ShippingRate[]>;
}

/** Local/staging stand-in until FedEx (phase 5). Never used when APP_ENV=production. */
export class MockShippingProvider implements ShippingProvider {
  readonly name = "mock";
  async rates(): Promise<ShippingRate[]> {
    return [
      { service: "mock_ground_asr", label: "Ground, adult signature (sandbox)", cents: 1450, adultSignature: true },
      { service: "mock_2day_asr", label: "2-Day, adult signature (sandbox)", cents: 3200, adultSignature: true },
    ];
  }
}

export type ShippingDecision = { ok: true; rate: ShippingRate } | { ok: false; code: "shipping_ineligible"; message: string };

/** Every cigar order requires Adult Signature Required: the service must be in the computed rates AND support it. */
export function eligibleService(chosen: string, rates: readonly ShippingRate[]): ShippingDecision {
  const rate = rates.find((r) => r.service === chosen);
  if (!rate || !rate.adultSignature) {
    return { ok: false, code: "shipping_ineligible", message: "Please choose an available shipping service that supports adult signature delivery." };
  }
  return { ok: true, rate };
}

/** Used when a configured provider is unavailable. Returns no rates, so checkout fails closed. */
export class UnavailableShippingProvider implements ShippingProvider {
  readonly name = "unavailable";
  async rates(): Promise<ShippingRate[]> { return []; }
}
