import Image from "next/image";
import { notFound } from "next/navigation";
import { getBrand, getListing } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";
import { PhotoBand, PhotoStrip, StoryPhoto, heroPhoto, storyPhoto } from "@/components/BrandPhotos";
import { BRAND_TILES } from "@/lib/brandTiles";
import { ComingSoonCollection } from "@/components/ComingSoonCollection";

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
  const heroBg = !brand.hero_path ? heroPhoto(brand.slug) : undefined;
  /** Ronald Isley's supplied "The Plug" cover graphic, shown exactly as supplied, with the intro below it. */
  const poster = brand.slug === "ronald-isley";
  return (
    <main id="main" className={`brand brand-${brand.template}`} style={{ "--accent": accent } as React.CSSProperties}>
      <section className={`brand-hero${heroMark && heroBg ? " hero-split" : ""}${poster ? " hero-poster" : ""}`}>
        {brand.hero_path && !poster && <Image src={brand.hero_path} alt="" fill priority sizes="100vw" className="hero-bg" />}
        {heroBg && !heroMark && !poster && <Image src={heroBg.src} alt={heroBg.alt} fill priority sizes="100vw" className="hero-bg" style={{ objectPosition: heroBg.pos }} />}
        <div className="hero-copy">
          {heroMark && (
            <div className="hero-crest" style={heroMark.markRatio ? { aspectRatio: heroMark.markRatio } : undefined}>
              <Image src={heroMark.mark} alt={heroMark.markAlt} fill priority sizes="(max-width: 900px) 80vw, 480px" />
            </div>
          )}
          {!heroMark && <p className="eyebrow">{brand.tagline}</p>}
          <h1 className={heroMark ? "brand-title sr-only" : "brand-title"}>{brand.name}</h1>
          <p>{brand.short_description}</p>
          {products[0] && <a className="btn" href="#boxes">Buy a box</a>}
        </div>
        {poster && (
          <div className="hero-poster-art">
            <Image src="/images/isley-the-plug-cover.jpg" alt="Ronald Isley in a white suit and aviator sunglasses holding a cigar, with the words The Plug Cigars by Ronald Isley" width={2000} height={2162} priority sizes="(max-width: 980px) 100vw, 980px" />
          </div>
        )}
        {heroMark && heroBg && (
          <div className="hero-photo">
            <Image src={heroBg.src} alt={heroBg.alt} fill priority sizes="(max-width: 900px) 100vw, 56vw" style={{ objectPosition: heroBg.pos }} />
          </div>
        )}
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
              {story.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {side && <StoryPhoto photo={side} />}
          </div>
        </section>
      )}
      <PhotoBand slug={brand.slug} />
      {products.length > 0 ? (
        <section className="section" id="boxes">
          <h2>{brand.template === "isley" ? "The Plug" : "Boxes"}</h2>
          <div className="grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      ) : (
        <ComingSoonCollection slug={brand.slug} />
      )}
      <PhotoStrip slug={brand.slug} />
    </main>
  );
}
