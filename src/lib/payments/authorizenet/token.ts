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
