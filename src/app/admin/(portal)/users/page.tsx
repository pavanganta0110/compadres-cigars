import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";
import { changeRoleAction, removeStaffAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };
const ERRORS: Record<string, string> = { last_owner: "There must always be at least one owner.", self: "You cannot remove your own access.", invalid: "That change was not valid." };

export default async function Users({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const me = await requireStaff("manage_users");
  const sp = await searchParams;
  const db = serviceClient();
  const { data: rows } = await db.from("staff").select("user_id, role, created_at").order("created_at");
  const users = await Promise.all((rows ?? []).map(async (r) => ({ ...r, email: (await db.auth.admin.getUserById(r.user_id)).data.user?.email ?? "unknown" })));
  return (
    <>
      <h1>Users</h1>
      <p className="adm-note">New staff are added from a terminal so no password is ever typed into a web form or shared in chat: <code>npm run admin:add-user -- name@example.com manager</code>. Roles: owner (everything), manager (no restrictions or users), fulfillment (orders only), viewer (read only).</p>
      {sp.saved && <p className="adm-note" role="status">Saved.</p>}
      {sp.error && <p className="adm-alert" role="alert">{ERRORS[sp.error] ?? "That change was not valid."}</p>}
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Email</th><th>Role</th><th>Change</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id}><td>{u.email}{u.user_id === me.id && " (you)"}</td><td>{u.role}</td>
              <td className="adm-inline">
                <form action={changeRoleAction} className="adm-inline"><input type="hidden" name="userId" value={u.user_id} />
                  <label>Role<select name="role" defaultValue={u.role}>{["owner", "manager", "fulfillment", "viewer"].map((r) => <option key={r}>{r}</option>)}</select></label>
                  <button className="adm-btn" type="submit">Save</button></form>
                {u.user_id !== me.id && <form action={removeStaffAction}><input type="hidden" name="userId" value={u.user_id} /><button className="adm-link" type="submit">Remove</button></form>}
              </td></tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
