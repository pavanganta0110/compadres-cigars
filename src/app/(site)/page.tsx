import Image from "next/image";
import Link from "next/link";
import { getBrands, getProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";

export default async function Home() {
  const [brands, products] = await Promise.all([getBrands(), getProducts()]);
  return (
    <main id="main">
      <section className="hero">
        <Image src="/images/isley-box-open.jpg" alt="" fill priority sizes="100vw" className="hero-bg" />
        <div className="hero-copy">
          <p className="eyebrow">Kansas City · Dominican handcrafted</p>
          <h1>Premium cigars, by the box.</h1>
          <p>Two brands. Ten cigars to a box. Delivered with an adult signature.</p>
          <Link className="btn" href="/shop">Shop the collection</Link>
        </div>
      </section>
      <section className="section">
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
      <section className="section">
        <h2>Featured boxes</h2>
        <div className="grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>
    </main>
  );
}

export const revalidate = 60;
