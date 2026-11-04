export type ComingSoonBlend = { name: string; wrapper: string; note: string };
export type ComingSoon = { eyebrow: string; title: string; blends: ComingSoonBlend[] };

/** Collections that are announced but have no products yet, keyed by brand slug. Shown instead of the boxes grid. */
export const BRAND_COMING_SOON: Record<string, ComingSoon> = {
  "jet-smoke-cigars": {
    eyebrow: "Coming soon",
    title: "The Signature Collection",
    blends: [
      { name: "Draft Pick", wrapper: "Connecticut", note: "A smooth, classic Connecticut blend that sets the stage for greatness." },
      { name: "6th Man", wrapper: "Habano", note: "Reliable and balanced, this Habano blend brings clutch flavor to every moment." },
      { name: "Queens Court", wrapper: "Sweet-tipped", note: "Sweet-tipped elegance with notes of vanilla and honey." },
    ],
  },
};
