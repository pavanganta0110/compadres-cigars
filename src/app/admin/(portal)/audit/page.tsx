import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit Log" };

export default async function Audit() {
  await requireStaff("view_audit");
  const { data } = await serviceClient().from("audit_log").select("id, at, actor, action, entity, entity_id, detail").order("id", { ascending: false }).limit(200);
  return (
    <>
      <h1>Audit Log</h1>
      <p className="adm-note">Append-only. Card data, tokens, keys and dates of birth are never recorded. Showing the latest 200 events.</p>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
        <tbody>
          {(data ?? []).map((e) => (
            <tr key={e.id}><td>{new Date(e.at).toLocaleString()}</td><td>{String(e.actor).slice(0, 8)}</td><td>{e.action}</td><td>{e.entity} {e.entity_id}</td><td><code>{JSON.stringify(e.detail)}</code></td></tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
