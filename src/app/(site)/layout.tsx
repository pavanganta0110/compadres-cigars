import Image from "next/image";
import Link from "next/link";
import { getBrands } from "@/lib/catalog";
import { LEGAL_PAGES } from "@/lib/legal";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const brands = await getBrands();
  return (
    <>
<a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <Link href="/" className="brandmark" aria-label="Compadres Premium Cigars, home">
            <Image src="/images/crest.png" alt="" width={64} height={64} priority />
            <span>Compadres</span>
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
              <Image src="/images/crest.png" alt="Compadres Premium Cigars" width={96} height={96} />
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
