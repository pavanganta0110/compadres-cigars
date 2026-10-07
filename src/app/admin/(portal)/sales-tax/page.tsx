import { formatUsd } from "@/lib/domain/money";
import { parsePeriod, taxReportFor } from "@/lib/server/report-data";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales & Tax" };

export default async function SalesTax({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireStaff("view_reports");
  const sp = await searchParams;
  const { from, to } = parsePeriod(sp.from, sp.to);
  const report = await taxReportFor(from, to);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const toIncl = new Date(to.getTime() - 86400_000);
  return (
    <>
      <h1>Sales &amp; Tax</h1>
      <p className="adm-note" role="note"><strong>Estimates only.</strong> {report.disclaimer}</p>
      <form className="adm-inline" method="get">
        <label>From<input type="date" name="from" defaultValue={iso(from)} /></label>
        <label>To<input type="date" name="to" defaultValue={iso(toIncl)} /></label>
        <button className="adm-btn" type="submit">Update</button>
        <a className="adm-btn" href={`/admin/sales-tax/export?from=${iso(from)}&to=${iso(toIncl)}`}>Export CSV</a>
      </form>
      <p>Finalized sales include processing, packed, completed and refunded orders. Refunds count in the period they were issued.</p>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>State</th><th>Orders</th><th>Taxable sales</th><th>Estimated tax collected</th><th>Refunds</th></tr></thead>
        <tbody>
          {report.rows.map((r) => <tr key={r.state}><td>{r.state}</td><td>{r.orders}</td><td>{formatUsd(r.taxable_cents)}</td><td>{formatUsd(r.tax_estimated_cents)}</td><td>{formatUsd(r.refunds_cents)}</td></tr>)}
          <tr><th>Total</th><th>{report.totals.orders}</th><th>{formatUsd(report.totals.taxable_cents)}</th><th>{formatUsd(report.totals.tax_estimated_cents)}</th><th>{formatUsd(report.totals.refunds_cents)}</th></tr>
        </tbody>
      </table></div>
    </>
  );
}
