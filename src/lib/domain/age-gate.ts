/**
 * 21+ site-entry gate cookie: signed (HMAC-SHA256), expiring, HttpOnly (set by server).
 * This is a NOTICE only. It is not identity verification; checkout age verification is separate.
 */
export const AGE_COOKIE = "cc_age";
export const AGE_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signAgeToken(secret: string, nowSeconds: number, ttl = AGE_COOKIE_TTL_SECONDS): Promise<string> {
  if (!secret) throw new Error("AGE_GATE_SECRET is required");
  const payload = String(nowSeconds + ttl);
  return `${payload}.${await hmac(secret, payload)}`;
}

/** Fails closed: any malformed, forged, expired or secret-less token is rejected. */
export async function verifyAgeToken(secret: string | undefined, token: string | undefined, nowSeconds: number): Promise<boolean> {
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!/^\d{1,12}$/.test(payload)) return false;
  if (!safeEqual(sig, await hmac(secret, payload))) return false;
  return Number(payload) > nowSeconds;
}

/** Only same-site relative paths are allowed as a post-gate redirect target. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw;
}
