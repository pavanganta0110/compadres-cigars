import { formatUsd } from "@/lib/domain/money";
import { can } from "@/lib/domain/permissions";
import { REMITTANCE_NOTE } from "@/lib/domain/taxRemittance";
import { loadRemittances, outstandingTax } from "@/lib/server/remittance-data";
import { requireStaff } from "@/lib/server/staff";
import { recordRemittanceAction, voidRemittanceAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tax payments" };

const STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

export default async function TaxPayments({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const staff = await requireStaff("view_reports");
  const sp = await searchParams;
  const [rows, owed] = await Promise.all([loadRemittances(), outstandingTax()]);
  const canRecord = can(staff.role, "manage_tax");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <h1>Tax payments</h1>
      <p className="adm-note" role="note"><strong>Estimates only.</strong> {REMITTANCE_NOTE}</p>
      {sp.saved && <p className="adm-note" role="status">Saved.</p>}
      {sp.error && <p className="adm-alert" role="alert">That entry was not valid. Check the amount, dates and state.</p>}

      <h2>Estimated tax still owed, by state</h2>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>State</th><th>Estimated tax collected (all time)</th><th>Recorded as paid</th><th>Still owed (estimate)</th></tr></thead>
        <tbody>
          {owed.map((o) => <tr key={o.state}><td>{o.state}</td><td>{formatUsd(o.collected_cents)}</td><td>{formatUsd(o.paid_cents)}</td><td>{o.outstanding_cents < 0 ? `${formatUsd(-o.outstanding_cents)} overpaid` : formatUsd(o.outstanding_cents)}</td></tr>)}
          {owed.length === 0 && <tr><td colSpan={4}>No taxed sales or payments yet.</td></tr>}
        </tbody>
      </table></div>

      {canRecord && (
        <>
          <h2>Record a payment you made</h2>
          <p>Pay in the state&apos;s own tax portal first, then record it here with the confirmation number.</p>
          <form action={recordRemittanceAction} className="adm-form">
            <label>State<select name="state" required defaultValue="">
              <option value="" disabled>Select</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Covers sales from<input type="date" name="periodFrom" required /></label>
            <label>Covers sales through<input type="date" name="periodTo" required /></label>
            <label>Amount paid (USD)<input name="amount" inputMode="decimal" placeholder="123.45" required /></label>
            <label>Date paid<input type="date" name="paidOn" defaultValue={today} required /></label>
            <label>How you paid<select name="method" defaultValue="state_portal">
              <option value="state_portal">State tax portal</option><option value="ach">ACH / bank transfer</option><option value="check">Check</option><option value="other">Other</option></select></label>
            <label>Confirmation number<input name="confirmation" maxLength={120} /></label>
            <label>Note<input name="note" maxLength={500} /></label>
            <button className="adm-btn" type="submit">Record payment</button>
          </form>
        </>
      )}

      <h2>Recorded payments</h2>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Paid on</th><th>State</th><th>Period</th><th>Amount</th><th>Method</th><th>Confirmation</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={r.voided_at ? { opacity: 0.5 } : undefined}>
              <td>{r.paid_on}</td><td>{r.state}</td><td>{r.period_from} to {r.period_to}</td><td>{formatUsd(r.amount_cents)}{r.voided_at && " (voided)"}</td>
              <td>{r.method}</td><td>{r.confirmation}</td>
              <td>{canRecord && !r.voided_at && <form action={voidRemittanceAction}><input type="hidden" name="id" value={r.id} /><button className="adm-link" type="submit">Void</button></form>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7}>No payments recorded yet.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
