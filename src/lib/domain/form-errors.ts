const LABELS: Record<string, string> = {
  brandId: "Brand", name: "Product name", sku: "SKU", price: "Price (use digits like 149.00, no $ or commas)", stock: "Stock", lowStock: "Alert level", boxQuantity: "Cigars per box",
  weightOz: "Box weight (digits like 24 or 24.5)", shortDescription: "Short description (max 300 characters)", description: "Description (max 4000 characters)",
  tagline: "Tagline (max 120 characters)", story: "Story (max 6000 characters)", accentColor: "Accent color (like #d6ad68)",
};
const SKU_HINT = "SKU must be 3 to 40 letters, digits or dashes, with no spaces";

/** "Check: SKU must be ..., Price ..." from a zod error's field names (never echoes the values). */
export function describeInvalid(issues: { path: PropertyKey[] }[]): string {
  const keys = [...new Set(issues.map((i) => String(i.path[0] ?? "")))].filter(Boolean);
  if (keys.length === 0) return "";
  return keys.map((k) => (k === "sku" ? SKU_HINT : LABELS[k] ?? k)).join("; ");
}
