export type Photo = { src: string; alt: string; pos?: string; /** CSS aspect-ratio for the beside-the-story slot, e.g. "2 / 3", so a tall photo is shown whole. */ ratio?: string };
export type BrandPhotos = {
  /** Hero background for a brand that has no banner photo set in the database. */
  hero?: Photo;
  /** Sits beside the brand story. */
  side?: Photo;
  /** A full-width photo between the story and the boxes. */
  band?: Photo;
  /** A short row after the boxes. */
  strip?: { eyebrow: string; photos: Photo[]; /** Portrait photos: tiles keep a 3:4 shape instead of a fixed height. */ tall?: boolean };
};

/** Brand-page photography, keyed by brand slug. Photos are spread through the page instead of stacked in one place. */
export const BRAND_PHOTOS: Record<string, BrandPhotos> = {
  "ronald-isley": {
    side: { src: "/images/isley-laughing.jpg", alt: "Ronald Isley in aviator sunglasses and a white suit, smiling as he holds a cigar", pos: "60% 40%", ratio: "8 / 7" },
    band: { src: "/images/isley-box-open.jpg", alt: "An open box of ten Ronald Isley The Plug cigars on a marble table, the Gold Standard seal inside the lid", pos: "50% 62%" },
  },
  sugarhill: {
    side: { src: "/images/sugarhill-group-portrait.jpg", alt: "Five men in sunglasses and hats posing together in a bright room", pos: "50% 30%" },
    band: { src: "/images/sugarhill-bw-skull-cane.jpg", alt: "Members of the Sugarhill Gang in black and white, one holding a gold skull-topped cane", pos: "40% 30%" },
    strip: {
      eyebrow: "From the archive",
      photos: [
        { src: "/images/sugarhill-woman-floral-dress.jpg", alt: "A woman in an orange and navy floral wrap dress and strappy heels, posing against a blue backdrop", pos: "50% 30%" },
        { src: "/images/sugarhill-woman-car-bw.jpg", alt: "A smiling woman in a beret and plaid trousers stepping out of a car on a city street, in black and white", pos: "50% 20%" },
        { src: "/images/sugarhill-woman-award-bw.jpg", alt: "A woman in a studded jacket and tall boots holding a framed gold record plaque, in black and white", pos: "50% 25%" },
        { src: "/images/sugarhill-woman-purple-jacket.jpg", alt: "A smiling woman in a purple jacket and large hoop earrings leaning on an orange armchair beside red poinsettias", pos: "50% 40%" },
      ],
    },
  },
  "compadres-cigars": {
    hero: { src: "/images/compadres-hero-cigar-whiskey.jpg", alt: "", pos: "50% 50%" },
    side: { src: "/images/compadres-still-life.jpg", alt: "A vintage typewriter, a framed old portrait, a hand-carved Compadres ashtray with a cigar resting on it, two glasses of amber liqueur and two Compadres cigars on a weathered wooden table", pos: "50% 50%", ratio: "2 / 3" },
    band: { src: "/images/compadres-lounge-red.jpg", alt: "A hand-carved Compadres ashtray with cigars resting on it, an open Compadres box and a Gran Corona box on the table, a woman in a red dress holding a cigar behind them", pos: "50% 62%" },
  },
  "jet-smoke-cigars": {
    hero: { src: "/images/jet-smoke-founders.jpg", alt: "", pos: "50% 38%" },
    side: { src: "/images/jet-smoke-basketball.jpg", alt: "A man in a black shirt lining up a jump shot with a basketball held over his head", pos: "50% 30%" },
    strip: {
      eyebrow: "Behind the brand",
      tall: true,
      photos: [
        { src: "/images/jet-smoke-tobacco-bundles.jpg", alt: "Bundles of dark tobacco laid out in a long row on a warehouse floor", pos: "50% 50%" },
        { src: "/images/jet-smoke-bundle-bands.jpg", alt: "A bundle of four cigars with black and gold bands", pos: "50% 50%" },
        { src: "/images/jet-smoke-bundles-table.jpg", alt: "Rows of banded cigar bundles stacked on a packing table", pos: "50% 50%" },
      ],
    },
  },
};
