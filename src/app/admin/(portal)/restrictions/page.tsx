import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";
import { setRestrictionAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Restrictions" };

export default async function Restrictions({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireStaff("manage_restrictions");
  const sp = await searchParams;
  const { data } = await serviceClient().from("restriction_rules").select("state, status, note, updated_at").order("state");
  return (
    <>
      <h1>Restrictions</h1>
      <p className="adm-note" role="note">Every state starts <strong>blocked</strong>, and a state with no row is also blocked. Allowing a state is a legal decision: confirm licensing and local rules first. This table is not a statement that any ruleset is complete or legally correct. Every change is recorded in the Audit Log.</p>
      {sp.saved && <p className="adm-note" role="status">Saved {sp.saved}.</p>}
      {sp.error === "confirm" && <p className="adm-alert" role="alert">Tick the confirmation box to allow a state.</p>}
      {sp.error === "invalid" && <p className="adm-alert" role="alert">That change was not valid.</p>}
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>State</th><th>Status</th><th>Note</th><th>Change</th></tr></thead>
        <tbody>
          {(data ?? []).map((r) => {
            const s = String(r.state).trim();
            const next = r.status === "allowed" ? "blocked" : "allowed";
            return (
              <tr key={s}>
                <td>{s}</td><td><span className={`adm-pill ${r.status === "blocked" ? "warn" : ""}`}>{r.status}</span></td><td>{r.note}</td>
                <td>
                  <form action={setRestrictionAction} className="adm-inline">
                    <input type="hidden" name="state" value={s} /><input type="hidden" name="status" value={next} />
                    <label>Note<input name="note" defaultValue={r.note ?? ""} aria-label={`Note for ${s}`} /></label>
                    {next === "allowed" && <label className="adm-check"><input type="checkbox" name="confirm" value="yes" />We are permitted to ship here</label>}
                    <button className="adm-btn" type="submit">{next === "allowed" ? `Allow ${s}` : `Block ${s}`}</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </>
  );
}
