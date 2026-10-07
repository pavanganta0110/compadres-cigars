/** FedEx configuration and the production gate. Relative imports only so scripts can load these files directly. */
export const FEDEX_PRODUCTION_ORIGIN = "https://apis.fedex.com";
export const FEDEX_SANDBOX_ORIGIN = "https://apis-sandbox.fedex.com";

export type FedExConfig = {
  appEnv: string; productionApproved: boolean; apiBaseUrl: string; clientId: string; clientSecret: string;
  accountNumber: string; originCountry: string; originState: string; originPostalCode: string;
};

export function fedexConfigFromEnv(env: Record<string, string | undefined>): FedExConfig {
  const t = (v: string | undefined) => (v ?? "").trim();
  return {
    appEnv: t(env.APP_ENV), productionApproved: t(env.COMPADRES_SHIPPING_PRODUCTION_APPROVED).toLowerCase() === "true",
    apiBaseUrl: t(env.COMPADRES_FEDEX_API_BASE_URL).replace(/\/+$/, ""), clientId: t(env.COMPADRES_FEDEX_CLIENT_ID),
    clientSecret: t(env.COMPADRES_FEDEX_CLIENT_SECRET), accountNumber: t(env.COMPADRES_FEDEX_ACCOUNT_NUMBER),
    originCountry: t(env.COMPADRES_FEDEX_ORIGIN_COUNTRY).toUpperCase(), originState: t(env.COMPADRES_FEDEX_ORIGIN_STATE).toUpperCase(),
    originPostalCode: t(env.COMPADRES_FEDEX_ORIGIN_POSTAL_CODE).toUpperCase(),
  };
}

/**
 * Configured only when: (not production OR explicitly approved) AND the API base URL matches the environment
 * (sandbox host outside production, production host in production) AND credentials and origin are well formed.
 */
export function isConfigured(c: FedExConfig): boolean {
  const production = c.appEnv === "production";
  if (production && !c.productionApproved) return false;
  if (c.apiBaseUrl !== (production ? FEDEX_PRODUCTION_ORIGIN : FEDEX_SANDBOX_ORIGIN)) return false;
  return /^[A-Za-z0-9._-]{1,128}$/.test(c.clientId) && c.clientSecret.length > 0 && c.clientSecret.length <= 256
    && /^[0-9]{9}$/.test(c.accountNumber) && /^[A-Z]{2}$/.test(c.originCountry)
    && /^[A-Z0-9]{1,3}$/.test(c.originState) && /^[A-Z0-9 -]{3,10}$/.test(c.originPostalCode);
}
