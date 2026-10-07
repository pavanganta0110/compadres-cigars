import type { TaxSnapshot } from "./tax";
import type { VerificationResult } from "./age";

export const COMPLIANCE_SNAPSHOT_VERSION = 1;

export type ComplianceSnapshot = {
  version: number; created_at: string;
  checks: { cart_stock: "passed"; geography: "passed"; age_verification: "passed"; adult_signature: "passed"; shipping_eligibility: "passed" };
  destination: { country: string; state: string; postal_code: string };
  age: { provider: string; reference: string; verified_at: string; expires_at: string; self_attestation_warning?: string };
  shipping: { service: string; adult_signature_required: true };
  tax: TaxSnapshot;
};

export function buildComplianceSnapshot(i: {
  now: Date; country: string; state: string; postalCode: string; age: VerificationResult; service: string; tax: TaxSnapshot;
}): ComplianceSnapshot {
  if (i.age.status !== "passed" || !i.age.verifiedAt || !i.age.expiresAt) throw new Error("age verification must have passed");
  return {
    version: COMPLIANCE_SNAPSHOT_VERSION, created_at: i.now.toISOString(),
    checks: { cart_stock: "passed", geography: "passed", age_verification: "passed", adult_signature: "passed", shipping_eligibility: "passed" },
    destination: { country: i.country.toUpperCase(), state: i.state.toUpperCase(), postal_code: i.postalCode },
    age: {
      provider: i.age.provider, reference: i.age.reference,
      verified_at: i.age.verifiedAt.toISOString(), expires_at: i.age.expiresAt.toISOString(),
      ...(i.age.provider === "self_attestation" ? { self_attestation_warning: "Checkbox-only attestation; not identity verification." } : {}),
    },
    shipping: { service: i.service, adult_signature_required: true },
    tax: i.tax,
  };
}
