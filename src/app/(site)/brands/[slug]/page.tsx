import Image from "next/image";
import { notFound } from "next/navigation";
import { getBrand, getProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getBrand((await params).slug);
  return { title: b?.name ?? "Not found", description: b?.short_description ?? undefined };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) notFound();
  const products = await getProducts(slug);
  const story = (brand.story ?? "").split("\n\n").filter(Boolean);
  const accent = brand.accent_color ?? "#d6ad68";
  return (
    <main id="main" className={`brand brand-${brand.template}`} style={{ "--accent": accent } as React.CSSProperties}>
      <section className="brand-hero">
        {brand.hero_path && <Image src={brand.hero_path} alt="" fill priority sizes="100vw" className="hero-bg" />}
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
        <section className="story">
          <div className="story-inner">
            <h2>{brand.template === "isley" ? "The legend" : "The story"}</h2>
            {story.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </section>
      )}
      <section className="section" id="boxes">
        <h2>{brand.template === "isley" ? "The Plug" : "Boxes"}</h2>
        <div className="grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>
    </main>
  );
}
