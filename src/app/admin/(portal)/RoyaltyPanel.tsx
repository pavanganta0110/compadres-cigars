import Link from "next/link";
import { formatUsd } from "@/lib/domain/money";
import { formatBps } from "@/lib/domain/tax";
import type { BrandRoyaltyRow } from "@/lib/server/royalty-data";

/** Dashboard summary: what each brand has earned this month and what is owed to them now. */
export function RoyaltyPanel({ rows }: { rows: BrandRoyaltyRow[] | null }) {
  if (!rows) return <p className="adm-note" role="note">Royalty figures are not available right now.</p>;
  const owed = rows.reduce((n, r) => n + r.owed, 0);
  const month = rows.reduce((n, r) => n + r.period.royaltyCents, 0);
  return (
    <section className="adm-panel" aria-labelledby="royalty-title">
      <div className="adm-head">
        <h3 id="royalty-title">Brand royalties</h3>
        <Link href="/admin/royalties">Open royalties</Link>
      </div>
      <p className="adm-muted">This month so far: <strong>{formatUsd(month)}</strong> earned · <strong>{formatUsd(owed)}</strong> owed to brands now</p>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Brand</th><th>Rate</th><th>Net sales this month</th><th>Royalty this month</th><th>Owed now</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.brandId}><th scope="row">{r.name}</th><td>{formatBps(r.rateBps)}%</td><td>{formatUsd(r.period.netCents)}</td><td><strong>{formatUsd(r.period.royaltyCents)}</strong></td><td>{formatUsd(r.owed)}</td></tr>)}
          {rows.length === 0 && <tr><td colSpan={5}>No brands yet.</td></tr>}
        </tbody>
      </table></div>
    </section>
  );
}
