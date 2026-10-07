import { FedExClient, fetchTransport } from "./client";
import type { FedExConfig } from "./config";
import { normalizeWeight } from "./weight";

type Rate = { service: string; label: string; cents: number; adultSignature: boolean };

/** ShippingProvider backed by FedEx. Any failure returns no rates: checkout then fails closed. */
export class FedExShippingProvider {
  readonly name = "fedex";
  private client: FedExClient;
  constructor(cfg: FedExConfig, transport = fetchTransport) { this.client = new FedExClient(cfg, transport); }
  async rates(ctx: { state: string; postalCode: string; weightOz: number }): Promise<Rate[]> {
    const w = normalizeWeight(ctx.weightOz, "oz");
    if (w.value <= 0) return [];
    try {
      const rates = await this.client.rates({ country: "US", state: ctx.state, postalCode: ctx.postalCode, weight: w.value, weightUnit: w.unit });
      return rates.filter((r) => r.currency === "USD").map((r) => ({ service: r.service, label: r.label, cents: r.cents, adultSignature: r.adultSignature }));
    } catch { return []; }
  }
}
