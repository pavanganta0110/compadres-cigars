/** Cigar strength as stored in products.strength, mapped to a 1-5 scale for the meter. Unknown or missing strength shows no meter. */
export const STRENGTH_LEVELS: Record<string, { level: number; label: string }> = {
  mild: { level: 1, label: "Mild" },
  "mild-medium": { level: 2, label: "Mild to medium" },
  medium: { level: 3, label: "Medium" },
  "medium-full": { level: 4, label: "Medium to full" },
  full: { level: 5, label: "Full" },
};

export function strengthOf(strength: string | null | undefined) {
  return strength ? STRENGTH_LEVELS[strength] ?? null : null;
}
