import Link from "next/link";
import { formatUsd } from "@/lib/domain/money";
import type { buildTaxReport } from "@/lib/domain/taxReport";
import type { OutstandingRow } from "@/lib/domain/taxRemittance";

type Report = ReturnType<typeof buildTaxReport>;

/** Month-to-date boxes sold and estimated sales tax by destination state. Estimates only. */
export function StateTaxPanel({ report, label, outstanding }: { report: Report; label: string; outstanding: OutstandingRow[] }) {
  const { rows, totals } = report;
  const owed = new Map(outstanding.map((o) => [o.state, o]));
  const totalOwed = outstanding.reduce((n, o) => n + o.outstanding_cents, 0);
  return (
    <>
      <p className="adm-note" role="note"><strong>Estimates only.</strong> {report.disclaimer} Refunds are shown separately and not netted out of the tax. Payments are made in each state&apos;s own tax portal and recorded here; this system does not send money. {label}</p>
      {rows.length === 0 ? <p>No paid orders yet this month.</p> : (
        <div className="adm-table-wrap"><table className="adm-table">
          <caption className="sr-only">Boxes sold and estimated sales tax by state</caption>
          <thead><tr><th>State</th><th>Boxes sold</th><th>Orders</th><th>Taxable sales</th><th>Estimated tax this month</th><th>Refunds</th><th>Still owed, all time (est.)</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.state}><td>{r.state}</td><td>{r.units}</td><td>{r.orders}</td><td>{formatUsd(r.taxable_cents)}</td><td>{formatUsd(r.tax_estimated_cents)}</td><td>{formatUsd(r.refunds_cents)}</td><td>{formatUsd(owed.get(r.state)?.outstanding_cents ?? 0)}</td></tr>)}
            <tr><th>Total</th><th>{totals.units}</th><th>{totals.orders}</th><th>{formatUsd(totals.taxable_cents)}</th><th>{formatUsd(totals.tax_estimated_cents)}</th><th>{formatUsd(totals.refunds_cents)}</th><th>{formatUsd(totalOwed)}</th></tr>
          </tbody>
        </table></div>
      )}
      <p><Link href="/admin/sales-tax/payments">Record or review tax payments</Link> · <Link href="/admin/sales-tax">Full Sales &amp; Tax report (any date range, CSV export)</Link></p>
    </>
  );
}
