"use client";
import { useRouter } from "next/navigation";

export type FlavorOption = { slug: string; label: string; soldOut: boolean };

/** Flavour dropdown: each flavour is its own product page, so choosing one navigates to it. */
export function FlavorSelect({ options, current }: { options: FlavorOption[]; current: string }) {
  const router = useRouter();
  return (
    <label className="flavor-select">Flavor
      <select value={current} onChange={(e) => router.push(`/products/${e.target.value}`)}>
        {options.map((o) => <option key={o.slug} value={o.slug}>{o.label}{o.soldOut ? " (sold out)" : ""}</option>)}
      </select>
    </label>
  );
}
