import { serviceClient } from "@/lib/server/db";
import { emailSetup } from "@/lib/server/email-service";
import { requireStaff } from "@/lib/server/staff";
import { retryEmailAction, sendTestEmailAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Emails" };

const KIND: Record<string, string> = {
  order_confirmation: "Order confirmation", order_shipped: "Shipped + tracking", refund_issued: "Refund", admin_new_order: "Staff: new order",
  admin_low_stock: "Staff: low stock", admin_needs_review: "Staff: needs review", admin_test: "Test",
};
const PILL: Record<string, string> = { sent: "", queued: "amber", sending: "amber", failed: "amber", skipped: "amber", dead: "warn" };

export default async function Emails({ searchParams }: { searchParams: Promise<{ test?: string; retried?: string }> }) {
  await requireStaff("manage_email");
  const sp = await searchParams;
  const setup = emailSetup();
  const { data } = await serviceClient().from("email_outbox").select("id, kind, to_email, subject, status, attempts, last_error, created_at, sent_at").order("created_at", { ascending: false }).limit(60);
  const counts = (data ?? []).reduce<Record<string, number>>((m, e) => ({ ...m, [e.status]: (m[e.status] ?? 0) + 1 }), {});
  return (
    <>
      <h1>Emails</h1>
      <p>
        <span className={`adm-pill ${setup.mode === "disabled" ? "warn" : ""}`}>{setup.mode}</span>{" "}
        <span className={`adm-pill ${setup.productionReady ? "" : "warn"}`}>{setup.productionReady ? "customers receive email" : "customers do not receive email yet"}</span>
      </p>
      <p className="adm-note">{setup.detail} Live customer email needs APP_ENV=production AND COMPADRES_EMAIL_PRODUCTION_APPROVED=true. Until then only staff and allowlisted addresses get real email; other recipients are marked skipped.</p>
      <p className="adm-muted">From: {setup.from || "not set"} · Staff alert addresses: {setup.adminEmails.length ? setup.adminEmails.join(", ") : "none set (COMPADRES_ADMIN_ALERT_EMAILS)"}</p>
      {sp.test && <p className={sp.test === "sent" ? "adm-note" : "adm-alert"} role={sp.test === "sent" ? "status" : "alert"}>{sp.test === "sent" ? "Test email sent to your own address." : sp.test === "skipped" ? "Test email skipped: add your address to COMPADRES_ADMIN_ALERT_EMAILS." : "Test email is queued but could not be sent yet. See the list below."}</p>}
      {sp.retried && <p className="adm-note" role="status">Retried.</p>}
      <form action={sendTestEmailAction}><button className="adm-btn" type="submit">Send a test email to me</button></form>
      <h2>Recent emails</h2>
      <p className="adm-muted">{Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" · ") || "Nothing yet."}</p>
      {(data ?? []).length > 0 && (
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>When</th><th>Type</th><th>To</th><th>Subject</th><th>Status</th><th /></tr></thead>
          <tbody>{(data ?? []).map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.created_at).toLocaleString()}</td><td>{KIND[e.kind] ?? e.kind}</td><td>{e.to_email}</td><td>{e.subject}</td>
              <td><span className={`adm-pill ${PILL[e.status] ?? ""}`}>{e.status}</span>{e.last_error && <><br /><small className="adm-muted">{e.last_error}</small></>}</td>
              <td>{["failed", "dead", "skipped"].includes(e.status) && <form action={retryEmailAction}><input type="hidden" name="emailId" value={e.id} /><button className="adm-link" type="submit" aria-label={`Retry email ${e.subject}`}>Retry</button></form>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
