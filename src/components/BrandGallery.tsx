import Image from "next/image";
import { BRAND_GALLERIES } from "@/lib/brandGallery";

export function BrandGallery({ template }: { template: string }) {
  const g = template === "isley" || template === "sugarhill" ? BRAND_GALLERIES[template] : undefined;
  if (!g) return null;
  return (
    <section className="section gallery-section" aria-labelledby="gallery-title">
      <p className="eyebrow">{g.eyebrow}</p>
      <h2 id="gallery-title">{g.title}</h2>
      <div className={`gallery${g.photos.length > 3 ? " gallery-many" : ""}`}>
        {g.photos.map((p, i) => (
          <figure key={p.src} className={`gallery-item${i === 0 ? " gallery-lead" : ""}`}>
            <Image src={p.src} alt={p.alt} fill sizes={i === 0 ? "(max-width: 800px) 100vw, 780px" : "(max-width: 800px) 100vw, 400px"} style={{ objectPosition: p.pos }} />
          </figure>
        ))}
      </div>
    </section>
  );
}
