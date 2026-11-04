import { strengthOf } from "@/lib/domain/strength";

/** Five-pip strength meter. Renders nothing when the product has no recorded strength (we never guess one). */
export function StrengthMeter({ strength }: { strength: string | null | undefined }) {
  const s = strengthOf(strength);
  if (!s) return null;
  return (
    <span className="strength" role="img" aria-label={`Strength: ${s.label}, ${s.level} of 5`}>
      <span className="strength-pips" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`pip${n <= s.level ? " on" : ""}`} />)}
      </span>
      <span className="strength-label" aria-hidden="true">{s.label}</span>
    </span>
  );
}
