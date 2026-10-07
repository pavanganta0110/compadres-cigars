import { getProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";

export const metadata = { title: "Shop" };

// Filters, result count and sort stay hidden while the catalog is tiny.
const SHOW_SHOP_FILTERS = process.env.NEXT_PUBLIC_SHOP_FILTERS === "true";

export default async function Shop() {
  const products = await getProducts();
  return (
    <main id="main" className="section">
      <h1>Shop</h1>
      {SHOW_SHOP_FILTERS && <p className="fine">{products.length} results</p>}
      <div className="grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
    </main>
  );
}
