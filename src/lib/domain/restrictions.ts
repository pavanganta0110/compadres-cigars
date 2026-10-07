/**
 * Geographic restrictions. Fail closed: a state is shippable ONLY if the editable table says 'allowed'.
 * This table is staff-maintained and is NOT a statement that any ruleset is complete or legally correct.
 */
export type RestrictionStatus = "allowed" | "blocked";
export type RestrictionDecision = { allowed: true } | { allowed: false; code: "geo_blocked"; message: string };

export const BLOCKED_MESSAGE = "We cannot ship tobacco products to this destination.";

export function evaluateDestination(country: string, state: string, rules: ReadonlyMap<string, RestrictionStatus>): RestrictionDecision {
  const s = state.trim().toUpperCase();
  if (country.trim().toUpperCase() !== "US" || !/^[A-Z]{2}$/.test(s) || rules.get(s) !== "allowed") {
    return { allowed: false, code: "geo_blocked", message: BLOCKED_MESSAGE };
  }
  return { allowed: true };
}
