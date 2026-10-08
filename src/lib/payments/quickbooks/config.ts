export const QB_API_SANDBOX = "https://sandbox.api.intuit.com";
export const QB_API_LIVE = "https://api.intuit.com";
export const QB_OAUTH_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const QB_OAUTH_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
export const QB_PAYMENTS_SCOPE = "com.intuit.quickbooks.payment";

export type QuickBooksConfig = {
  clientId: string; clientSecret: string; redirectUri: string; webhookVerifier: string; encryptionKey: string;
};

export function quickbooksConfigFromEnv(env: Record<string, string | undefined>): QuickBooksConfig {
  const t = (v: string | undefined) => (v ?? "").trim();
  return {
    clientId: t(env.COMPADRES_QUICKBOOKS_CLIENT_ID), clientSecret: t(env.COMPADRES_QUICKBOOKS_CLIENT_SECRET),
    redirectUri: t(env.COMPADRES_QUICKBOOKS_REDIRECT_URI), webhookVerifier: t(env.COMPADRES_QUICKBOOKS_WEBHOOK_VERIFIER),
    encryptionKey: t(env.COMPADRES_TOKEN_ENCRYPTION_KEY),
  };
}

/** Configured = client credentials, an https redirect URI (http only for localhost) and an encryption key for stored tokens. */
export function quickbooksConfigured(c: QuickBooksConfig): boolean {
  let uriOk = false;
  try { const u = new URL(c.redirectUri); uriOk = u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname)); } catch { /* invalid */ }
  return c.clientId.length >= 8 && c.clientSecret.length >= 8 && uriOk && c.encryptionKey.length >= 32;
}

export const quickbooksApiBase = (mode: "sandbox" | "live") => (mode === "live" ? QB_API_LIVE : QB_API_SANDBOX);
/** The browser tokenizes the card directly with Intuit, so the page needs this (public) URL. */
export const quickbooksTokenizeUrl = (mode: "sandbox" | "live") => `${quickbooksApiBase(mode)}/quickbooks/v4/payments/tokens`;

export const QB_STATE_COOKIE = "cc_qb_state";
