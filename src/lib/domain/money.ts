/** Money is always integer cents. */
export function formatUsd(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("cents must be an integer");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
