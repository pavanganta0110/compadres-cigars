const SENSITIVE_KEY = /(card|pan|cvv|cvc|token|secret|password|passwd|key|authorization|dob|birth|ssn|account_number)/i;
const CARD_LIKE = /\b(?:\d[ -]?){13,19}\b/;

/** Redacts anything that looks like card data, tokens, keys or dates of birth before it reaches the audit log. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (typeof value === "string") return CARD_LIKE.test(value) ? "[redacted]" : value.length > 500 ? value.slice(0, 500) + "…" : value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1)]));
  }
  return value;
}
