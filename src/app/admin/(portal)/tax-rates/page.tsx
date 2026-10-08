import { ADMIN_OVERRIDE, formatBps, TAX_RATES_BPS } from "@/lib/domain/tax";
import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";
import { resetTaxRateAction, updateTaxRateAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tax Rates" };

export default async function TaxRates({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireStaff("manage_tax");
  const sp = await searchParams;
  const { data } = await serviceClient().from("tax_rates").select("state, rate_bps, matrix_sha256, effective_date, updated_at").order("state");
  const rows = data ?? [];
  const changed = rows.filter((r) => r.matrix_sha256 === ADMIN_OVERRIDE).length;
  return (
    <>
      <h1>Tax Rates</h1>
      <p className="adm-note" role="note"><strong>Estimates only.</strong> These are average combined rates per destination state, applied to the product subtotal (shipping is not taxed). A change applies immediately to new checkouts and is recorded in the audit log and in each order&apos;s tax snapshot. Orders already placed keep the rate they were charged. Have a tax professional review rates before launch. District of Columbia has no rate, so it stays blocked.</p>
      {sp.saved && <p className="adm-note" role="status">Saved the rate for {sp.saved.slice(0, 2)}.</p>}
      {sp.error && <p className="adm-alert" role="alert">Enter a percentage from 0 to 30 with up to two decimals, for example 8.44.</p>}
      <p className="adm-muted">{changed === 0 ? "All 50 states use the business-approved matrix." : `${changed} state${changed === 1 ? "" : "s"} changed from the approved matrix.`}</p>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>State</th><th>Approved matrix</th><th>Current rate (%)</th><th>Source</th><th>Effective</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => {
            const approved = TAX_RATES_BPS[String(r.state).trim()];
            const edited = r.matrix_sha256 === ADMIN_OVERRIDE;
            return (
              <tr key={r.state}>
                <th scope="row">{String(r.state).trim()}</th>
                <td>{approved === undefined ? "n/a" : `${formatBps(approved)}%`}</td>
                <td>
                  <form action={updateTaxRateAction} className="adm-inline">
                    <input type="hidden" name="state" value={String(r.state).trim()} />
                    <label><span className="sr-only">Rate for {String(r.state).trim()} in percent</span><input name="percent" inputMode="decimal" defaultValue={formatBps(r.rate_bps)} required /></label>
                    <button className="adm-btn" type="submit">Save</button>
                  </form>
                </td>
                <td>{edited ? <span className="adm-pill amber">edited</span> : "approved matrix"}</td>
                <td>{r.effective_date}</td>
                <td>{edited && approved !== undefined && (
                  <form action={resetTaxRateAction}><input type="hidden" name="state" value={String(r.state).trim()} /><button className="adm-link" type="submit">Reset to {formatBps(approved)}%</button></form>
                )}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </>
  );
}
