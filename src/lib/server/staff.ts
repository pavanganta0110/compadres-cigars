import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Permission, type Role } from "@/lib/domain/permissions";
import { redact } from "@/lib/domain/audit";
import { serviceClient } from "./db";

/** Cookie-bound Supabase Auth client (anon key). Used only to sign staff in/out and read the session. */
export async function authClient() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => { try { for (const c of list) jar.set(c.name, c.value, c.options); } catch { /* server component: read-only */ } },
    },
  });
}

export type Staff = { id: string; email: string; role: Role };

/** The session is validated with Supabase (getUser), then the role is read from our own `staff` table. */
export async function currentStaff(): Promise<Staff | null> {
  const { data } = await (await authClient()).auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  const { data: row } = await serviceClient().from("staff").select("role").eq("user_id", user.id).maybeSingle();
  return row ? { id: user.id, email: user.email, role: row.role as Role } : null;
}

/** Call at the top of EVERY admin page, route handler and server action. The layout alone is not enough. */
export async function requireStaff(permission: Permission = "view"): Promise<Staff> {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  if (!can(staff.role, permission)) redirect("/admin?denied=1");
  return staff;
}

export async function auditAdmin(actor: string, action: string, entity: string | null, entityId: string | null, detail: Record<string, unknown> = {}) {
  await serviceClient().from("audit_log").insert({ actor, action, entity, entity_id: entityId, detail: redact(detail) as object });
}
