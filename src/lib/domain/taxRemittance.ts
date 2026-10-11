import type { StateRow } from "./taxReport";

export type Remittance = { state: string; amount_cents: number; voided_at?: string | null };
export type OutstandingRow = { state: string; collected_cents: number; paid_cents: number; outstanding_cents: number };

export const REMITTANCE_NOTE =
  "This system tracks tax payments staff make in each state's own tax portal. It does not send money to any state. Amounts are estimates; confirm what is owed with a tax professional before paying.";

/** Estimated tax collected (all time) minus recorded, non-voided payments, per state. Negative = recorded more than collected. */
export function outstandingByState(collected: StateRow[], remittances: Remittance[]): OutstandingRow[] {
  const paid = new Map<string, number>();
  for (const r of remittances) if (!r.voided_at) paid.set(r.state.trim(), (paid.get(r.state.trim()) ?? 0) + r.amount_cents);
  const states = new Set<string>([...collected.map((c) => c.state), ...paid.keys()]);
  return [...states].sort().map((state) => {
    const c = collected.find((x) => x.state === state)?.tax_estimated_cents ?? 0;
    const p = paid.get(state) ?? 0;
    return { state, collected_cents: c, paid_cents: p, outstanding_cents: c - p };
  });
}

/** "12.34" -> 1234. Rejects negatives, zero, more than 2 decimals, and anything not a plain amount. */
export function parseDollarsToCents(v: string): number | null {
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(v.trim());
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0);
  return cents > 0 ? cents : null;
}
