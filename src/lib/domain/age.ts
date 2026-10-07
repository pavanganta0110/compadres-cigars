/**
 * Age verification sits behind a provider interface so an ID vendor (AgeChecker-style) can replace
 * self-attestation later. WARNING: checkbox-only self-attestation carries regulatory and underwriting risk.
 */
export type VerificationStatus = "passed" | "failed" | "pending" | "unavailable";

export type VerificationRequest = {
  /** Only values the SERVER read from its own form handling. Client-supplied "passed"/"verified" fields are never part of this. */
  attested: boolean;
};

export type VerificationResult = {
  provider: string; reference: string; status: VerificationStatus; verifiedAt: Date | null; expiresAt: Date | null;
};

export interface AgeVerificationProvider {
  readonly name: string;
  verify(req: VerificationRequest): Promise<VerificationResult>;
}

export class SelfAttestationProvider implements AgeVerificationProvider {
  readonly name = "self_attestation";
  constructor(private now: () => Date = () => new Date(), private ref: () => string = () => crypto.randomUUID()) {}
  async verify(req: VerificationRequest): Promise<VerificationResult> {
    const reference = `self-attested-${this.ref()}`;
    if (req.attested !== true) return { provider: this.name, reference, status: "failed", verifiedAt: null, expiresAt: null };
    const at = this.now();
    return { provider: this.name, reference, status: "passed", verifiedAt: at, expiresAt: new Date(at.getTime() + 24 * 3600_000) };
  }
}

export function allowsCheckout(r: VerificationResult, now: Date): boolean {
  return r.status === "passed" && r.expiresAt !== null && r.expiresAt.getTime() > now.getTime();
}
