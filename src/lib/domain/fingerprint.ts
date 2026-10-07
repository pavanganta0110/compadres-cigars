export type FingerprintInput = {
  items: { productId: string; quantity: number }[];
  country: string; state: string; postalCode: string; shippingService: string;
  /** Per-browser checkout session so two customers buying the same cart never collide. */
  sessionId: string;
};

/** Stable SHA-256 over normalized cart + destination + shipping method (+ session). Used as the 60s idempotency lease key. */
export async function cartFingerprint(i: FingerprintInput): Promise<string> {
  const items = i.items.map((x) => [x.productId, x.quantity] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  const payload = JSON.stringify({
    items, country: i.country.trim().toUpperCase(), state: i.state.trim().toUpperCase(),
    postal: i.postalCode.replace(/\s+/g, "").toUpperCase(), shipping: i.shippingService.trim().toLowerCase(), session: i.sessionId,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
