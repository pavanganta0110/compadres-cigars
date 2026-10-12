import { LionMark } from "@/components/LionMark";
import Link from "next/link";
import { getBrands } from "@/lib/catalog";
import { LEGAL_PAGES } from "@/lib/legal";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const brands = await getBrands();
  return (
    <>
<a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <Link href="/" className="brandmark" aria-label="Lion Premium Cigars, home">
            <LionMark size={56} />
            <span>Lion Cigars</span>
          </Link>
          <nav aria-label="Primary">
            <Link href="/shop">Shop</Link>
            <Link href="/cart">Cart</Link>
            {brands.map((b) => <Link key={b.id} href={`/brands/${b.slug}`}>{b.name}</Link>)}
          </nav>
        </header>
      {children}
        <footer className="site-footer">
          <div className="footer-grid">
            <div>
              <LionMark size={88} />
              <p>1111 E. 73rd St, Kansas City, MO 64131</p>
            </div>
            <nav aria-label="Legal">
              {Object.entries(LEGAL_PAGES).map(([slug, p]) => <Link key={slug} href={`/legal/${slug}`}>{p.title}</Link>)}
            </nav>
          </div>
          <p className="fine">Tobacco products are for adults 21+ only. Shipments require an adult signature. We do not ship to restricted jurisdictions.</p>
        </footer>
    </>
  );
}
