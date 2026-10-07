import Image from "next/image";
import Link from "next/link";
import { formatUsd } from "@/lib/domain/money";
import type { Product } from "@/lib/catalog";

export function ProductCard({ product }: { product: Product }) {
  const img = product.images[0];
  return (
    <article className="card">
      <Link href={`/products/${product.slug}`} className="card-media">
        {img && <Image src={img.path} alt={img.alt} fill sizes="(max-width:700px) 100vw, 360px" />}
      </Link>
      <div className="card-body">
        <p className="eyebrow">{product.brand.name}</p>
        <h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
        <p className="price">{formatUsd(product.price_cents)}</p>
      </div>
    </article>
  );
}
