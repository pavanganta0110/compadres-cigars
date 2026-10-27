export const ANET_API_SANDBOX = "https://apitest.authorize.net/xml/v1/request.api";
export const ANET_API_LIVE = "https://api.authorize.net/xml/v1/request.api";
export const ANET_ACCEPT_JS_SANDBOX = "https://jstest.authorize.net/v1/Accept.js";
export const ANET_ACCEPT_JS_LIVE = "https://js.authorize.net/v1/Accept.js";

export type AuthorizeNetConfig = { apiLoginId: string; transactionKey: string; signatureKey: string; clientKey: string };

/** Same variable names as the original Lion Cigars site, plus the public client key that Accept.js needs. */
export function authorizenetConfigFromEnv(env: Record<string, string | undefined>): AuthorizeNetConfig {
  const t = (v: string | undefined) => (v ?? "").trim();
  return {
    apiLoginId: t(env.AUTHNET_API_LOGIN_ID), transactionKey: t(env.AUTHNET_TRANSACTION_KEY),
    signatureKey: t(env.AUTHNET_SIGNATURE_KEY), clientKey: t(env.AUTHNET_CLIENT_KEY),
  };
}

/** Configured = every credential present. The signature key (webhooks) is required so a webhook can never be accepted unsigned. */
export function authorizenetConfigured(c: AuthorizeNetConfig): boolean {
  return c.apiLoginId.length >= 4 && c.transactionKey.length >= 8 && c.signatureKey.length >= 16 && c.clientKey.length >= 8;
}

export const authorizenetApiUrl = (mode: "sandbox" | "live") => (mode === "live" ? ANET_API_LIVE : ANET_API_SANDBOX);
export const authorizenetAcceptJsUrl = (mode: "sandbox" | "live") => (mode === "live" ? ANET_ACCEPT_JS_LIVE : ANET_ACCEPT_JS_SANDBOX);
