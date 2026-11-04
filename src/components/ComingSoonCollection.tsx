import { BRAND_COMING_SOON } from "@/lib/brandComingSoon";

export function ComingSoonCollection({ slug }: { slug: string }) {
  const c = BRAND_COMING_SOON[slug];
  if (!c) return null;
  return (
    <section className="section" id="boxes" aria-labelledby="soon-title">
      <p className="eyebrow">{c.eyebrow}</p>
      <h2 id="soon-title">{c.title}</h2>
      <ul className="soon-grid">
        {c.blends.map((b) => (
          <li key={b.name} className="soon-card">
            <span className="soon-wrapper">{b.wrapper}</span>
            <h3>{b.name}</h3>
            <p>{b.note}</p>
            <span className="soon-badge">Coming soon</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
