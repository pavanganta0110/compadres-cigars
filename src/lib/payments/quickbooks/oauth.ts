import { QB_OAUTH_AUTHORIZE_URL, QB_OAUTH_TOKEN_URL, QB_PAYMENTS_SCOPE, type QuickBooksConfig } from "./config";
import type { Transport } from "./transport";

export type StoredTokens = { refreshToken: string; accessToken?: string; accessExpiresAt?: number; refreshExpiresAt?: number };
export interface TokenStore { load(): Promise<StoredTokens | null>; save(t: StoredTokens): Promise<void> }

export class NotConnectedError extends Error { constructor() { super("QuickBooks is not connected"); } }

export function authorizeUrl(c: QuickBooksConfig, state: string): string {
  const q = new URLSearchParams({ client_id: c.clientId, response_type: "code", scope: QB_PAYMENTS_SCOPE, redirect_uri: c.redirectUri, state });
  return `${QB_OAUTH_AUTHORIZE_URL}?${q}`;
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; x_refresh_token_expires_in?: number };

/** OAuth2 for Intuit Payments. Refresh tokens ROTATE, so every refresh result is persisted before it is used. */
export class QuickBooksOAuth {
  private cache: { token: string; expiresAt: number } | null = null;
  constructor(private cfg: QuickBooksConfig, private store: TokenStore, private http: Transport, private now: () => number = Date.now) {}

  private async post(form: Record<string, string>): Promise<{ status: number; json: TokenResponse }> {
    const basic = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString("base64");
    const r = await this.http({
      method: "POST", url: QB_OAUTH_TOKEN_URL,
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(form).toString(),
    });
    let json: TokenResponse = {};
    try { json = JSON.parse(r.text) as TokenResponse; } catch { /* non-JSON */ }
    return { status: r.status, json };
  }

  private async persist(j: TokenResponse, fallbackRefresh?: string): Promise<string> {
    const refreshToken = j.refresh_token ?? fallbackRefresh;
    if (!j.access_token || !refreshToken) throw new Error("QuickBooks token response was incomplete");
    const t = this.now();
    const accessExpiresAt = t + (j.expires_in ?? 3600) * 1000;
    await this.store.save({ refreshToken, accessToken: j.access_token, accessExpiresAt, refreshExpiresAt: j.x_refresh_token_expires_in ? t + j.x_refresh_token_expires_in * 1000 : undefined });
    this.cache = { token: j.access_token, expiresAt: accessExpiresAt };
    return j.access_token;
  }

  async exchangeCode(code: string): Promise<void> {
    const r = await this.post({ grant_type: "authorization_code", code, redirect_uri: this.cfg.redirectUri });
    if (r.status !== 200) throw new Error(`QuickBooks code exchange failed (HTTP ${r.status})`);
    await this.persist(r.json);
  }

  invalidate() { this.cache = null; }

  async accessToken(): Promise<string> {
    if (this.cache && this.cache.expiresAt - this.now() > 60_000) return this.cache.token;
    const stored = await this.store.load();
    if (!stored) throw new NotConnectedError();
    if (stored.accessToken && stored.accessExpiresAt && stored.accessExpiresAt - this.now() > 60_000) {
      this.cache = { token: stored.accessToken, expiresAt: stored.accessExpiresAt };
      return stored.accessToken;
    }
    let r = await this.post({ grant_type: "refresh_token", refresh_token: stored.refreshToken });
    if (r.status !== 200) {
      // Another instance may have rotated the refresh token a moment ago: reload once and retry with the newer one.
      const again = await this.store.load();
      if (again && again.refreshToken !== stored.refreshToken) {
        if (again.accessToken && again.accessExpiresAt && again.accessExpiresAt - this.now() > 60_000) return again.accessToken;
        r = await this.post({ grant_type: "refresh_token", refresh_token: again.refreshToken });
      }
    }
    if (r.status !== 200) throw new NotConnectedError();
    return this.persist(r.json, stored.refreshToken);
  }
}
