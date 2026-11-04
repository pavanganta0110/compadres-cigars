export type GalleryPhoto = { src: string; alt: string; pos?: string };
export type BrandGallery = { eyebrow: string; title: string; photos: GalleryPhoto[] };

/** Brand-page photo galleries, keyed by the brand template. The first photo is the large feature tile. */
export const BRAND_GALLERIES: Partial<Record<"isley" | "sugarhill", BrandGallery>> = {
  isley: {
    eyebrow: "In the spotlight",
    title: "Smooth, like the man himself",
    photos: [
      { src: "/images/isley-portrait-white-suit.jpg", alt: "Ronald Isley in aviator sunglasses and a white suit, holding a cigar, a gold-handled cane at his side", pos: "62% 40%" },
      { src: "/images/isley-sequin-tuxedo.jpg", alt: "Ronald Isley in a black sequined tuxedo, bow tie and round sunglasses, a cigar in his hand", pos: "50% 22%" },
      { src: "/images/isley-cigar-in-hand.jpg", alt: "A cigar held between two fingers, a ring on the hand, against a black sequined jacket", pos: "40% 60%" },
    ],
  },
  sugarhill: {
    eyebrow: "The crew",
    title: "Godfathers of hip-hop",
    photos: [
      { src: "/images/sugarhill-bw-skull-cane.jpg", alt: "Four members of the Sugarhill Gang in black and white, one holding a gold skull-topped cane", pos: "40% 35%" },
      { src: "/images/sugarhill-group-portrait.jpg", alt: "Five men in sunglasses and hats posing together in a bright room", pos: "50% 30%" },
      { src: "/images/sugarhill-gang-logo-group.png", alt: "The Sugarhill Gang logo in colorful striped lettering above four members posing", pos: "50% 50%" },
    ],
  },
};
