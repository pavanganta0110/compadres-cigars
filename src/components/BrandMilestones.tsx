import { BRAND_MILESTONES } from "@/lib/brandMilestones";

export function BrandMilestones({ template }: { template: string }) {
  const m = template === "isley" ? BRAND_MILESTONES.isley : undefined;
  if (!m) return null;
  return (
    <section className="section milestones" aria-labelledby="milestones-title">
      <p className="eyebrow">{m.eyebrow}</p>
      <h2 id="milestones-title">{m.title}</h2>
      <ol className="milestone-list">
        {m.items.map((i) => (
          <li key={i.year}>
            <span className="milestone-year">{i.year}</span>
            <span className="milestone-text">{i.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
