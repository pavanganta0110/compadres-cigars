/** Stock alerts. A product is "out" at 0, "low" at or below its own threshold, otherwise "ok". Drafts never alert. */
export type StockState = "out" | "low" | "ok";
export type StockRow = { id: string; name: string; sku: string; stock: number; low_stock_threshold: number; active: boolean };

export function stockState(stock: number, threshold: number): StockState {
  if (stock <= 0) return "out";
  return stock <= threshold ? "low" : "ok";
}

export type StockAlert = StockRow & { state: "out" | "low" };
/** Published products that need restocking, emptiest first. */
export function stockAlerts(rows: StockRow[]): StockAlert[] {
  return rows
    .filter((r) => r.active)
    .flatMap((r) => { const s = stockState(r.stock, r.low_stock_threshold); return s === "ok" ? [] : [{ ...r, state: s }]; })
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
}

/** Slugs are generated from names: lowercase letters, digits and single hyphens. */
export function slugify(name: string): string {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
