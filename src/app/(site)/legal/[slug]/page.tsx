import { notFound } from "next/navigation";
import { LEGAL_PAGES } from "@/lib/legal";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = LEGAL_PAGES[(await params).slug];
  return { title: p?.title ?? "Not found" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = LEGAL_PAGES[(await params).slug];
  if (!page) notFound();
  return (
    <main id="main" className="prose-page">
      <p className="legal-flag" role="note"><strong>Legal review required.</strong> This page is a placeholder and is not approved legal text.</p>
      <h1>{page.title}</h1>
      <p>{page.summary}</p>
    </main>
  );
}
