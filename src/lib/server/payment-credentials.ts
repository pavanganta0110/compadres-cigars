import "server-only";
import { open, seal } from "@/lib/payments/secretbox";
import type { StoredTokens, TokenStore } from "@/lib/payments/quickbooks/oauth";
import { serviceClient } from "./db";

/** QuickBooks OAuth tokens, AES-256-GCM encrypted with an env key before they reach the database. */
export class DbTokenStore implements TokenStore {
  constructor(private encryptionKey: string, private provider = "quickbooks") {}
  async load(): Promise<StoredTokens | null> {
    const { data } = await serviceClient().from("payment_credentials").select("ciphertext").eq("provider", this.provider).maybeSingle();
    if (!data) return null;
    const plain = open(this.encryptionKey, data.ciphertext as string);
    if (!plain) return null;
    try { const t = JSON.parse(plain) as StoredTokens; return typeof t.refreshToken === "string" ? t : null; } catch { return null; }
  }
  async save(t: StoredTokens): Promise<void> {
    const { error } = await serviceClient().from("payment_credentials").upsert({ provider: this.provider, ciphertext: seal(this.encryptionKey, JSON.stringify(t)), updated_at: new Date().toISOString() });
    if (error) throw new Error("Could not store payment credentials");
  }
}
