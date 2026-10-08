/** Opaque processor tokens only. Anything that could be a card number is refused before it is used or logged. */
const TOKEN_SHAPE = /^[A-Za-z0-9_.:-]{8,300}$/;
const DIGITS_ONLY_LONG = /^\d[\d ]{11,22}\d$/;

export function isAcceptableToken(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (!TOKEN_SHAPE.test(t)) return false;
  if (DIGITS_ONLY_LONG.test(t)) return false;   // a PAN pasted where a token belongs
  return true;
}

export const MOCK_TOKEN_PREFIX = "mock_tok_";
const luhn = (n: string) => {
  let sum = 0;
  for (let i = 0; i < n.length; i++) { let d = Number(n[n.length - 1 - i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
  return sum % 10 === 0;
};
/** Mock "tokenization" runs in the browser, exactly where the real processor's would. Test cards only. */
export function mockTokenForCard(cardNumber: string, rand: () => string = () => Math.random().toString(36).slice(2, 10)): string {
  const n = cardNumber.replace(/[\s-]/g, "");
  const kind = !/^\d{13,19}$/.test(n) || !luhn(n) ? "invalid" : n === "4000000000000002" ? "decline" : n === "4242424242424242" ? "approve" : "invalid";
  return `${MOCK_TOKEN_PREFIX}${kind}_${rand()}`;
}
