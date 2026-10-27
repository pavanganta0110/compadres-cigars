/**
 * Accept.js turns a card into a single-use "payment nonce" (opaqueData.dataValue) in the browser. It is wrapped as an
 * opaque token that passes the shared token-shape check: URL-safe base64 characters only, with a recognizable prefix.
 * Browser-safe on purpose (no Node imports): the checkout page and the server both use it.
 */
export const ANET_TOKEN_PREFIX = "anet_";
/** The only descriptor Accept.js issues for card payments. */
export const ANET_DESCRIPTOR = "COMMON.ACCEPT.INAPP.PAYMENT";

export function encodeAnetToken(dataValue: string): string {
  return ANET_TOKEN_PREFIX + dataValue.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Returns the Accept.js dataValue, or null when the token is not one of ours. */
export function decodeAnetToken(token: string): string | null {
  if (!token.startsWith(ANET_TOKEN_PREFIX)) return null;
  const body = token.slice(ANET_TOKEN_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{8,}$/.test(body)) return null;
  const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
  return b64 + "=".repeat((4 - (b64.length % 4)) % 4);
}

/**
 * Customer-safe text for an Accept.js error code (returned by the browser script, never by our server). Only a code of the
 * expected shape is echoed, so nothing else from the response can reach the page.
 */
export function acceptJsMessage(code: unknown): string {
  const c = typeof code === "string" && /^E(_WC)?_?\d{2,5}$/.test(code) ? code : undefined;
  switch (c) {
    case "E_WC_05": return "That card number is not valid.";
    case "E_WC_06": return "That expiration month is not valid.";
    case "E_WC_07": return "That expiration year is not valid.";
    case "E_WC_08": return "That card has expired.";
    case "E_WC_15": return "That security code is not valid.";
    case "E_WC_10": case "E_WC_11": case "E_WC_12": case "E_WC_13": case "E_WC_14":
      return `Card payments are not set up correctly (Authorize.net rejected this site's keys, code ${c}). Please contact us.`;
    default: return `We could not read those card details${c ? ` (code ${c})` : ""}. Please check them and try again.`;
  }
}
