import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_PAGES } from "@/lib/legal";
import { contactFromEnv, LEGAL_DOCS, LEGAL_UPDATED, US_STATE_NAMES } from "@/lib/legal-content";
import { serviceClient } from "@/lib/server/db";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = LEGAL_PAGES[(await params).slug];
  return { title: p?.title ?? "Not found", description: p?.summary };
}

/** Current shipping settings, straight from the staff-maintained table. Falls back to nothing (never guesses) if it cannot be read. */
async function shippingStates(): Promise<{ allowed: string[]; blocked: string[] } | null> {
  try {
    const { data, error } = await serviceClient().from("restriction_rules").select("state, status");
    if (error || !data) return null;
    const name = (s: string) => US_STATE_NAMES[s.trim()] ?? s.trim();
    return {
      allowed: data.filter((r) => r.status === "allowed").map((r) => name(r.state)).sort(),
      blocked: data.filter((r) => r.status !== "allowed").map((r) => name(r.state)).sort(),
    };
  } catch { return null; }
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const page = Object.hasOwn(LEGAL_PAGES, slug) ? LEGAL_PAGES[slug] : undefined;
  const doc = Object.hasOwn(LEGAL_DOCS, slug) ? LEGAL_DOCS[slug] : undefined;
  if (!page || !doc) notFound();
  const contact = contactFromEnv();
  const states = slug === "restrictions" ? await shippingStates() : null;
  return (
    <main id="main" className="prose-page legal-doc">
      <p className="legal-flag" role="note"><strong>Legal review required.</strong> This page is a draft and is not approved legal text.</p>
      <h1>{page.title}</h1>
      <p className="legal-meta">Last updated {LEGAL_UPDATED}</p>
      <p className="legal-intro">{doc.intro}</p>

      {states && (
        <>
          <h2>Where we can ship right now</h2>
          {states.allowed.length > 0 ? <ul className="state-list">{states.allowed.map((s) => <li key={s}>{s}</li>)}</ul> : <p>We are not currently shipping to any state. Please check back soon.</p>}
          <h2>Where we cannot ship right now</h2>
          {states.blocked.length > 0 ? <ul className="state-list">{states.blocked.map((s) => <li key={s}>{s}</li>)}</ul> : <p>We have not blocked any state beyond the rules below.</p>}
        </>
      )}

      {doc.blocks(contact).map((b) => (
        <section key={b.h}>
          <h2>{b.h}</h2>
          {b.p?.map((t) => <p key={t}>{t}</p>)}
          {b.ul && <ul>{b.ul.map((t) => <li key={t}>{t}</li>)}</ul>}
        </section>
      ))}

      <nav aria-label="Related policies" className="legal-related">
        <h2>Related policies</h2>
        <ul>
          {Object.entries(LEGAL_PAGES).filter(([s]) => s !== slug).map(([s, p]) => <li key={s}><Link href={`/legal/${s}`}>{p.title}</Link></li>)}
        </ul>
      </nav>
    </main>
  );
}
