import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, specRows } from "@/lib/catalog";
import { formatUsd } from "@/lib/domain/money";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProduct((await params).slug);
  return { title: p?.name ?? "Not found", description: p?.short_description ?? undefined };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const [main, ...rest] = product.images;
  return (
    <main id="main" className="section product">
      <div className="gallery">
        {main && <div className="gallery-main"><Image src={main.path} alt={main.alt} fill priority sizes="(max-width:900px) 100vw, 620px" /></div>}
        <div className="thumbs">
          {rest.map((i) => <div key={i.path} className="thumb"><Image src={i.path} alt={i.alt} fill sizes="160px" /></div>)}
        </div>
      </div>
      <div className="product-info">
        <p className="eyebrow"><Link href={`/brands/${product.brand.slug}`}>{product.brand.name}</Link></p>
        <h1>{product.name}</h1>
        <p className="price price-lg">{formatUsd(product.price_cents)}</p>
        {product.placeholder_price && <p className="fine" role="note">Placeholder price, pending owner approval.</p>}
        <p>{product.description}</p>
        {/* Cart arrives in phase 2; the control is rendered but inert until then. */}
        <button className="btn" type="button" disabled aria-disabled="true">Add to Cart</button>
        <p className="fine">Sold by the box. Adult signature required on delivery. Must be 21+.</p>
        <h2>Specifications</h2>
        <dl className="specs">
          {specRows(product).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
      </div>
    </main>
  );
}
