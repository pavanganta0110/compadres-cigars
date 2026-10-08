/** Staff enter dollars; we work in integer cents and validate before anything touches the processor. */
export function parseDollarsToCents(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [d, c = ""] = s.split(".");
  const cents = Number(d) * 100 + Number(c.padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

export type RefundCheck = { ok: true } | { ok: false; code: "invalid_amount" | "exceeds_captured" | "nothing_to_refund" };
/** Mirrors begin_refund() in SQL (which is the authority); lets the UI refuse early with a clear message. */
export function checkRefund(opts: { amountCents: number; capturedCents: number; reservedCents: number }): RefundCheck {
  if (!Number.isInteger(opts.amountCents) || opts.amountCents <= 0) return { ok: false, code: "invalid_amount" };
  if (opts.capturedCents <= 0) return { ok: false, code: "nothing_to_refund" };
  if (opts.reservedCents + opts.amountCents > opts.capturedCents) return { ok: false, code: "exceeds_captured" };
  return { ok: true };
}
