export type Photo = { src: string; alt: string; pos?: string };
export type BrandPhotos = {
  /** Sits beside the brand story. */
  side?: Photo;
  /** A full-width photo between the story and the boxes. */
  band?: Photo;
  /** A short row after the boxes. */
  strip?: { eyebrow: string; photos: Photo[] };
};

/** Brand-page photography, keyed by brand slug. Photos are spread through the page instead of stacked in one place. */
export const BRAND_PHOTOS: Record<string, BrandPhotos> = {
  "ronald-isley": {
    side: { src: "/images/isley-sequin-tuxedo.jpg", alt: "Ronald Isley in a black sequined tuxedo, bow tie and round sunglasses, a cigar in his hand", pos: "50% 20%" },
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
    side: { src: "/images/compadres-hand-rolling.jpg", alt: "Hands rolling a cigar at the rolling table, tobacco leaf spread out around the roller", pos: "55% 45%" },
    band: { src: "/images/compadres-open-box-cutter.jpg", alt: "An open black Compadres box of cigars with the lion crest, beside a glass of whiskey and a cigar cutter", pos: "50% 55%" },
    strip: {
      eyebrow: "From leaf to box",
      photos: [
        { src: "/images/compadres-tobacco-leaf.jpg", alt: "A man holding up a single large, dark tobacco leaf", pos: "50% 40%" },
        { src: "/images/compadres-pressing.jpg", alt: "A wooden cigar press with a stack of molds under a screw press", pos: "50% 45%" },
      ],
    },
  },
};
