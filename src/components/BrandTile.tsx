import Image from "next/image";
import Link from "next/link";
import { BRAND_TILES } from "@/lib/brandTiles";
import type { Brand } from "@/lib/catalog";
import { IsleySeal } from "@/components/IsleySeal";

export function BrandTile({ brand }: { brand: Brand }) {
  const s = BRAND_TILES[brand.slug];
  if (!s) {
    return (
      <Link href={`/brands/${brand.slug}`} className={`tile tile-${brand.template}`}>
        <span className="eyebrow">{brand.tagline}</span>
        <span className="tile-name">{brand.name}</span>
      </Link>
    );
  }
  return (
    <Link href={`/brands/${brand.slug}`} className={`tile tile-branded ${s.cls}`}>
      <span className="tile-mark">
        {brand.slug === "ronald-isley" ? (
          <IsleySeal portrait={s.mark} label={s.markAlt} />
        ) : (
          <Image src={s.mark} alt={s.markAlt} fill sizes="(max-width: 700px) 90vw, 360px" style={{ objectPosition: s.pos }} />
        )}
      </span>
      <span className="tile-caption">
        {brand.tagline && <span className="eyebrow">{brand.tagline}</span>}
        <span className={`tile-name${s.nameInMark ? " sr-only" : ""}`}>{brand.name}</span>
      </span>
    </Link>
  );
}
