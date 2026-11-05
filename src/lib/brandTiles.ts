/** Home-page "Our brands" tiles: each brand's own mark and look, keyed by brand slug. Brands not listed fall back to a plain text tile. */
export type BrandTileStyle = {
  mark: string;
  markAlt: string;
  /** Tile modifier class (colors and type live in globals.css). */
  cls: string;
  /** The mark already spells out the brand name, so the visible name is dropped and kept for screen readers only. */
  nameInMark?: boolean;
  /** Focal point when the mark is cropped to fill the tile. */
  pos?: string;
  /** Also show the mark in the brand-page hero when the brand has no banner photo. Only for marks with a transparent background. */
  heroMark?: boolean;
  /** CSS aspect-ratio of the mark when it is not the Compadres crest ratio, e.g. "1870 / 690". */
  markRatio?: string;
};

export const BRAND_TILES: Record<string, BrandTileStyle> = {
  "ronald-isley": { mark: "/images/ronald-isley-logo.png", markAlt: "Ronald Isley The Gold Standard logo", cls: "tile-b-isley", nameInMark: true },
  sugarhill: { mark: "/images/sugarhill-logo-crop.jpg", markAlt: "Sugar Hill logo in striped lettering", cls: "tile-b-sugarhill", nameInMark: true },
  "compadres-cigars": { mark: "/images/compadres-crest.png", markAlt: "Compadres Premium Cigars crest with two lions", cls: "tile-b-compadres", nameInMark: true, heroMark: true },
  "jet-smoke-cigars": { mark: "/images/jet-smoke-mark.png", markAlt: "Jet Smoke logo: a cigar shaped like a fighter jet with the words Jet Smoke in gold on its wings", cls: "tile-b-jet", nameInMark: true, heroMark: true, markRatio: "1600 / 1177" },
  "americo-cigars": { mark: "/images/americo-logo.png", markAlt: "Americo Cigars logo", cls: "tile-b-americo", nameInMark: true },
};
