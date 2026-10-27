import { describe, expect, it } from "vitest";
import { collapseVariants, sortVariants } from "./variants";

const p = (slug: string, g: string | null, l: string | null = null) => ({ slug, variant_group: g, variant_label: l });

describe("variants", () => {
  it("collapses a group to its first product and keeps ungrouped products in order", () => {
    const out = collapseVariants([p("a", null), p("v", "Cigarillos", "Vanilla"), p("b", null), p("c", "Cigarillos", "Cherry")]);
    expect(out.map((x) => x.slug)).toEqual(["a", "v", "b"]);
  });
  it("sorts flavours alphabetically with Variety last", () => {
    const out = sortVariants([p("1", "G", "Variety"), p("2", "G", "Vanilla"), p("3", "G", "Cherry")]);
    expect(out.map((x) => x.variant_label)).toEqual(["Cherry", "Vanilla", "Variety"]);
  });
});
