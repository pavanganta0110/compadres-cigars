/** Normalizes a product weight (ounces in our schema) to FedEx units. Zero means unknown, and rating fails closed. */
export function normalizeWeight(value: number, unit: string): { value: number; unit: "LB" | "KG" } {
  const empty = { value: 0, unit: "LB" as const };
  if (!Number.isFinite(value) || value <= 0) return empty;
  const r = (n: number) => Math.round(n * 100) / 100;
  switch (unit.trim().toLowerCase()) {
    case "lb": case "lbs": return { value: r(value), unit: "LB" };
    case "oz": return { value: r(value / 16), unit: "LB" };
    case "kg": return { value: r(value), unit: "KG" };
    case "g": return { value: r(value / 1000), unit: "KG" };
    default: return empty;
  }
}
