import { formatUsd } from "@/lib/domain/money";
import { can } from "@/lib/domain/permissions";
import { formatBps } from "@/lib/domain/tax";
import { loadRoyalties } from "@/lib/server/royalty-data";
import { parsePeriod } from "@/lib/server/report-data";
import { requireStaff } from "@/lib/server/staff";
import { recordPayoutAction, setRoyaltyRateAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Royalties" };

const ERRORS: Record<string, string> = {
  invalid_rate: "Enter a percentage from 0 to 100 with up to two decimals, for example 10 or 7.5.", invalid_date: "Enter a valid effective date.",
  invalid_payout: "That payout was not valid.", invalid_amount: "Enter the amount in dollars, for example 250.00.", exceeds_balance: "That is more than the brand is currently owed.",
};

export default async function Royalties({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; saved?: string; error?: string }> }) {
  const staff = await requireStaff("view_royalties");
  const sp = await searchParams;
  const { from, to } = parsePeriod(sp.from, sp.to);
  const { rows, payouts } = await loadRoyalties(from, to);
  const names = new Map(rows.map((r) => [r.brandId, r.name]));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const toIncl = new Date(to.getTime() - 86400_000);
  const edit = can(staff.role, "manage_royalties");
  const totals = rows.reduce((t, r) => ({ sales: t.sales + r.period.netCents, royalty: t.royalty + r.period.royaltyCents, owed: t.owed + r.owed }), { sales: 0, royalty: 0, owed: 0 });
  return (
    <>
      <div className="adm-head">
        <h1>Brand royalties</h1>
        <a className="adm-btn" href={`/admin/royalties/export?from=${iso(from)}&to=${iso(toIncl)}`}>Export CSV</a>
      </div>
      <p className="adm-note" role="note">Royalty = the brand&apos;s percentage of <strong>net product sales</strong>: the item subtotal of paid orders, with no tax and no shipping, reduced in proportion to refunds. Each order uses the rate that applied when it was paid, so a rate change never rewrites past sales. This page records what is owed and what has been paid; it does not send money.</p>
      {sp.saved && <p className="adm-note" role="status">{sp.saved === "payout" ? "Payout recorded." : "Rate saved."}</p>}
      {sp.error && <p className="adm-alert" role="alert">{ERRORS[sp.error] ?? ERRORS.invalid_payout}</p>}

      <form method="get" className="adm-inline">
        <label>From<input type="date" name="from" defaultValue={iso(from)} /></label>
        <label>To<input type="date" name="to" defaultValue={iso(toIncl)} /></label>
        <button className="adm-btn" type="submit">Update</button>
      </form>

      <div className="adm-kpis">
        <div className="adm-kpi"><span>Net sales in period</span><strong>{formatUsd(totals.sales)}</strong><small>all brands</small></div>
        <div className="adm-kpi"><span>Royalties earned in period</span><strong>{formatUsd(totals.royalty)}</strong><small>all brands</small></div>
        <div className="adm-kpi"><span>Owed to brands now</span><strong>{formatUsd(totals.owed)}</strong><small>earned all time minus paid</small></div>
      </div>

      <h2>By brand</h2>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Brand</th><th>Rate</th><th>Units sold</th><th>Net sales</th><th>Royalty earned</th><th>Paid out (all time)</th><th>Owed now</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.brandId}>
              <th scope="row">{r.name}{!r.active && <> <span className="adm-pill amber">draft</span></>}</th>
              <td>{formatBps(r.rateBps)}%</td><td>{r.period.units}</td><td>{formatUsd(r.period.netCents)}</td><td><strong>{formatUsd(r.period.royaltyCents)}</strong></td>
              <td>{formatUsd(r.paidOut)}</td><td><strong>{formatUsd(r.owed)}</strong></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7}>No brands yet.</td></tr>}
        </tbody>
      </table></div>

      {edit && (
        <>
          <h2>Set a royalty rate</h2>
          <p className="adm-muted">Applies to orders paid on or after the effective date (today if left blank). Pick an earlier date to include sales already made.</p>
          <div className="adm-stack">
            {rows.map((r) => (
              <form key={r.brandId} action={setRoyaltyRateAction} className="adm-inline">
                <input type="hidden" name="brandId" value={r.brandId} />
                <label>{r.name}: royalty rate (%)<input name="percent" inputMode="decimal" defaultValue={formatBps(r.rateBps)} required /></label>
                <label>Effective from (optional)<input type="date" name="effective" /></label>
                <button className="adm-btn" type="submit" aria-label={`Save royalty rate for ${r.name}`}>Save rate</button>
              </form>
            ))}
          </div>

          <h2>Record a payout</h2>
          <p className="adm-muted">Use this after you pay a brand by check, bank transfer or wire. It lowers what is owed.</p>
          <div className="adm-stack">
            {rows.filter((r) => r.owed > 0).map((r) => (
              <form key={r.brandId} action={recordPayoutAction} className="adm-inline">
                <input type="hidden" name="brandId" value={r.brandId} />
                <label>{r.name}: amount paid (USD, up to {formatUsd(r.owed)})<input name="amount" inputMode="decimal" required /></label>
                <label>Date paid<input type="date" name="paidOn" /></label>
                <label>Reference (check or transfer number)<input name="reference" maxLength={120} /></label>
                <button className="adm-btn" type="submit" aria-label={`Record payout to ${r.name}`}>Record payout</button>
              </form>
            ))}
            {rows.every((r) => r.owed === 0) && <p>Nothing is owed to any brand right now.</p>}
          </div>
        </>
      )}

      <h2>Payout history</h2>
      {payouts.length === 0 ? <p>No payouts recorded yet.</p> : (
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Date paid</th><th>Brand</th><th>Amount</th><th>Reference</th></tr></thead>
          <tbody>{payouts.map((p) => <tr key={p.id}><td>{p.paid_on}</td><td>{names.get(p.brand_id) ?? "Brand"}</td><td>{formatUsd(p.amount_cents)}</td><td>{p.reference}</td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}
