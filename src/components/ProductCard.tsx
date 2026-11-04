import Image from "next/image";
import Link from "next/link";
import { formatUsd } from "@/lib/domain/money";
import type { Product } from "@/lib/catalog";
import { StrengthMeter } from "@/components/StrengthMeter";

/** One-line facts for a card: size and box count, only what we actually have. */
function cardFacts(p: Product): string {
  const size = p.ring_gauge && p.length_in ? `${p.ring_gauge} × ${p.length_in}` : null;
  return [size, `Box of ${p.box_quantity}`].filter(Boolean).join(" · ");
}

export function ProductCard({ product }: { product: Product }) {
  const img = product.images[0];
  const soldOut = product.stock <= 0;
  return (
    <article className="card">
      <Link href={`/products/${product.slug}`} className="card-media" aria-label={product.name}>
        {img && <Image src={img.path} alt={img.alt} fill sizes="(max-width:700px) 100vw, 360px" />}
        {soldOut && <span className="card-badge">Sold out</span>}
      </Link>
      <div className="card-body">
        <p className="eyebrow">{product.brand.name}</p>
        <h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
        <p className="card-facts">{cardFacts(product)}</p>
        <StrengthMeter strength={product.strength} />
        <div className="card-foot">
          <p className="price">{formatUsd(product.price_cents)}</p>
          <Link href={`/products/${product.slug}`} className="card-link">View box<span aria-hidden="true"> →</span></Link>
        </div>
      </div>
    </article>
  );
}
