import { BrandTile } from "@/components/BrandTile";
export default function P() {
  const b = (slug: string, name: string, tagline: string) => ({ slug, name, tagline, template: "default" }) as never;
  return <section className="section"><div className="brand-tiles">
    <BrandTile brand={b("compadres-cigars", "Compadres Cigars", "Premium cigars")} />
    <BrandTile brand={b("ronald-isley", "Ronald Isley", "The Gold Standard")} />
    <BrandTile brand={b("sugarhill", "Sugarhill", "Rapper's Delight")} />
    <BrandTile brand={b("americo-cigars", "Americo Cigars", "A legacy meant to be savored")} />
    <BrandTile brand={b("jet-smoke-cigars", "Jet Smoke Cigars", "Premium Cigars for Champions")} />
  </div></section>;
}
