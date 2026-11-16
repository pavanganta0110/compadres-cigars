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

/** Photos supplied by the Isley team, shown whole (never cropped). */
const ISLEY_GALLERY = [
  { src: "/images/isley-green-sequin-suit.jpg", w: 854, h: 1280, alt: "Ronald Isley in a green sequined double-breasted suit and round sunglasses, against a green mosaic wall" },
  { src: "/images/isley-cigar-conversation.jpg", w: 1280, h: 854, alt: "Ronald Isley in a white suit and aviator sunglasses laughing, holding a cigar" },
  { src: "/images/isley-balcony-sunset.jpg", w: 1280, h: 856, alt: "Ronald Isley in a black brocade suit with a cane on a balcony at sunset" },
  { src: "/images/isley-gold-mosaic.jpg", w: 1280, h: 854, alt: "Ronald Isley in a black hat and a yellow floral suit, with a cane, against a gold and black mosaic" },
];

/** From the official Ronald Isley biography (supplied by the Isley team). */
const ISLEY_ACCOMPLISHMENTS = [
  { head: "1959", text: "Co-wrote the hit “Shout”" },
  { head: "Grammy", text: "Lifetime Achievement Award, 2014, with The Isley Brothers" },
  { head: "2026", text: "Star on the Hollywood Walk of Fame" },
  { head: "8 decades", text: "Chart appearances spanning eight decades" },
  { head: "No. 1", text: "“Make Me Say It Again, Girl” with Beyoncé held the top spot on Billboard’s Adult R&B Airplay chart for five weeks" },
  { head: "Today", text: "Still recording and performing for audiences around the world" },
];

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
            <Image src="/images/isley-the-plug-cover.jpg" alt="Ronald Isley in a white suit and aviator sunglasses holding a cigar, with the words The Plug Cigars by Ronald Isley" width={2000} height={2162} priority sizes="100vw" />
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
      {brand.template === "isley" && (
        <section className="accolades" aria-labelledby="accolades-h">
          <h2 id="accolades-h">Key accomplishments</h2>
          <ul>
            {ISLEY_ACCOMPLISHMENTS.map((a) => (
              <li key={a.head}><strong>{a.head}</strong><span>{a.text}</span></li>
            ))}
          </ul>
        </section>
      )}
      {brand.template === "isley" && (
        <section className="isley-gallery" aria-label="Ronald Isley photos">
          {ISLEY_GALLERY.map((g) => (
            <figure key={g.src}>
              <Image src={g.src} alt={g.alt} width={g.w} height={g.h} sizes="(max-width: 800px) 100vw, 50vw" />
            </figure>
          ))}
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
