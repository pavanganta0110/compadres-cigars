import Image from "next/image";
import { BRAND_PHOTOS, type Photo } from "@/lib/brandPhotos";

/** Hero background used when the brand has no banner photo in the database. */
export function heroPhoto(slug: string): Photo | undefined {
  return BRAND_PHOTOS[slug]?.hero;
}

/** The photo shown beside the brand story, if the brand has one. */
export function storyPhoto(slug: string): Photo | undefined {
  return BRAND_PHOTOS[slug]?.side;
}

export function StoryPhoto({ photo }: { photo: Photo }) {
  return (
    <figure className="story-photo">
      <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 900px) 100vw, 460px" style={{ objectPosition: photo.pos }} />
    </figure>
  );
}

/** A full-width photo between the story and the boxes. */
export function PhotoBand({ slug }: { slug: string }) {
  const p = BRAND_PHOTOS[slug]?.band;
  if (!p) return null;
  return (
    <figure className="photo-band">
      <Image src={p.src} alt={p.alt} fill sizes="100vw" style={{ objectPosition: p.pos }} />
    </figure>
  );
}

/** A short row of photos after the boxes. */
export function PhotoStrip({ slug }: { slug: string }) {
  const s = BRAND_PHOTOS[slug]?.strip;
  if (!s) return null;
  return (
    <section className="section photo-strip" aria-label={s.eyebrow}>
      <p className="eyebrow">{s.eyebrow}</p>
      <div className="photo-strip-row" data-count={s.photos.length} data-tall={s.tall ? "true" : undefined}>
        {s.photos.map((p) => (
          <figure key={p.src} className="strip-item">
            <Image src={p.src} alt={p.alt} fill sizes="(max-width: 700px) 50vw, 300px" style={{ objectPosition: p.pos }} />
          </figure>
        ))}
      </div>
    </section>
  );
}
