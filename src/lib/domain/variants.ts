/** Flavour/size selector support: products sharing a variant_group are listed once and chosen on the product page. */
export type VariantFields = { slug: string; variant_group: string | null; variant_label: string | null };

/** Keeps one product per variant group (the first in the given order) and every ungrouped product, preserving order. */
export function collapseVariants<T extends VariantFields>(products: T[]): T[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    if (!p.variant_group) return true;
    if (seen.has(p.variant_group)) return false;
    seen.add(p.variant_group);
    return true;
  });
}

/** Flavour order for a group: the order shown in the dropdown, with "Variety" last. */
export function sortVariants<T extends VariantFields>(variants: T[]): T[] {
  const rank = (v: T) => (v.variant_label?.toLowerCase() === "variety" ? 1 : 0);
  return [...variants].sort((a, b) => rank(a) - rank(b) || (a.variant_label ?? "").localeCompare(b.variant_label ?? ""));
}
