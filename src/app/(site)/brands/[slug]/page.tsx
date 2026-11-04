import Image from "next/image";
import { notFound } from "next/navigation";
import { getBrand, getListing } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";
import { PhotoBand, PhotoStrip, StoryPhoto, storyPhoto } from "@/components/BrandPhotos";
import { BRAND_TILES } from "@/lib/brandTiles";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getBrand((await params).slug);
  return { title: b?.name ?? "Not found", description: b?.short_description ?? undefined };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) notFound();
  const products = await getListing(slug);
  const story = (brand.story ?? "").split("\n\n").filter(Boolean);
  const accent = brand.accent_color ?? "#d6ad68";
  const side = story.length > 0 ? storyPhoto(brand.slug) : undefined;
  const tile = BRAND_TILES[brand.slug];
  const heroMark = !brand.hero_path && tile?.heroMark ? tile : undefined;
  return (
    <main id="main" className={`brand brand-${brand.template}`} style={{ "--accent": accent } as React.CSSProperties}>
      <section className="brand-hero">
        {brand.hero_path && <Image src={brand.hero_path} alt="" fill priority sizes="100vw" className="hero-bg" />}
        {heroMark && (
          <div className="hero-mark">
            <Image src={heroMark.mark} alt={heroMark.markAlt} fill priority sizes="(max-width: 900px) 60vw, 560px" />
          </div>
        )}
        <div className="hero-copy">
          <p className="eyebrow">{brand.tagline}</p>
          <h1 className="brand-title">{brand.name}</h1>
          <p>{brand.short_description}</p>
          {products[0] && <a className="btn" href="#boxes">Buy a box</a>}
        </div>
      </section>
      <ul className="trust" aria-label="Highlights">
        <li>Handcrafted in the Dominican Republic</li>
        <li>Sold exclusively by the box</li>
        <li>Adult signature on delivery</li>
      </ul>
      {story.length > 0 && (
        <section className={`story${side ? " story-has-photo" : ""}`}>
          <div className={side ? "story-grid" : undefined}>
            <div className="story-inner">
              <h2>{brand.template === "isley" ? "The legend" : "The story"}</h2>
              {story.map((p, i) => <p key={i} className={i === 0 ? "story-lead" : undefined}>{p}</p>)}
            </div>
            {side && <StoryPhoto photo={side} />}
          </div>
        </section>
      )}
      <PhotoBand slug={brand.slug} />
      <section className="section" id="boxes">
        <h2>{brand.template === "isley" ? "The Plug" : "Boxes"}</h2>
        <div className="grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>
      <PhotoStrip slug={brand.slug} />
    </main>
  );
}
