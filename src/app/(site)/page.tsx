import Image from "next/image";
import Link from "next/link";
import { getBrands, getProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";

/** Lifestyle photography. `pos` keeps faces in frame when a portrait photo is cropped into a wider tile. */
const MOSAIC = [
  { src: "/images/life-lounge-smoke.jpg", alt: "A man in a blue patterned shirt lounging in a leather chair, wreathed in cigar smoke", pos: "50% 38%", cls: "tall" },
  { src: "/images/life-couch.jpg", alt: "A woman in a black blazer exhaling cigar smoke on a tan leather sofa while friends look on", pos: "70% 45%" },
  { src: "/images/life-pool-shot.jpg", alt: "A bearded man lining up a pool shot with a cigar in his mouth", pos: "50% 22%" },
  { src: "/images/life-smoke-closeup.jpg", alt: "A woman in red glasses leaning back with a cigar, smoke swirling around her", pos: "55% 40%" },
  { src: "/images/life-pool-hat.jpg", alt: "A man in a bowler hat and white shirt with a cigar, studying the pool table", pos: "60% 25%" },
] as const;

export default async function Home() {
  const [brands, products] = await Promise.all([getBrands(), getProducts()]);
  return (
    <main id="main">
      <section className="hero hero-photo">
        <Image src="/images/life-smoke-profile.jpg" alt="" fill priority sizes="100vw" className="hero-bg hero-bg-right" />
        <div className="hero-copy">
          <p className="eyebrow">Kansas City · Dominican handcrafted</p>
          <h1>Premium cigars, by the box.</h1>
          <p>Two brands. Ten cigars to a box. Delivered with an adult signature.</p>
          <div className="hero-actions">
            <Link className="btn" href="/shop">Shop the collection</Link>
            <Link className="btn btn-ghost" href="#brands">Meet the brands</Link>
          </div>
        </div>
      </section>

      <ul className="trust" aria-label="Highlights">
        <li>Handcrafted in the Dominican Republic</li>
        <li>Sold exclusively by the box</li>
        <li>Adult signature on delivery</li>
      </ul>

      <section className="section" id="brands">
        <h2>Our brands</h2>
        <div className="brand-tiles">
          {brands.map((b) => (
            <Link key={b.id} href={`/brands/${b.slug}`} className={`tile tile-${b.template}`}>
              <span className="eyebrow">{b.tagline}</span>
              <span className="tile-name">{b.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="feature" aria-labelledby="life-title">
        <div className="feature-photo">
          <Image src="/images/life-pool-group.jpg" alt="Four friends in black and white evening wear with cigars around a pool table under industrial lamps" fill sizes="(max-width: 900px) 100vw, 520px" />
        </div>
        <div className="feature-copy">
          <p className="eyebrow">The Compadres life</p>
          <h2 id="life-title">Good cigars. Better company.</h2>
          <p>Slow evenings, a friendly game, and a box worth sharing. Every Compadres cigar is rolled by hand in the Dominican Republic and made for the moments you want to last a little longer.</p>
          <Link className="btn" href="/shop">Find your box</Link>
        </div>
      </section>

      <section className="section" aria-labelledby="moments-title">
        <p className="eyebrow">Moments</p>
        <h2 id="moments-title">Made to be shared</h2>
        <div className="mosaic">
          {MOSAIC.map((m) => (
            <figure key={m.src} className={`mosaic-item ${"cls" in m ? m.cls : ""}`}>
              <Image src={m.src} alt={m.alt} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 400px" style={{ objectPosition: m.pos }} />
            </figure>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Featured boxes</h2>
        <div className="grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>

      <section className="cta-band">
        <h2>Ready when you are.</h2>
        <p>Choose a box, check out in minutes, and we ship it with an adult signature.</p>
        <Link className="btn" href="/shop">Shop the collection</Link>
      </section>
    </main>
  );
}

export const revalidate = 60;
