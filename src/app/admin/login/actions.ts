"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auditAdmin, authClient, currentStaff } from "@/lib/server/staff";

const Creds = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(200) });

export async function loginAction(formData: FormData) {
  const parsed = Creds.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/login?error=1");
  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  const staff = error ? null : await currentStaff();
  if (!staff) {
    if (!error) await supabase.auth.signOut();   // signed in but not staff
    await auditAdmin("anonymous", "admin.login_failed", "staff", null, { email: parsed.data.email });
    redirect("/admin/login?error=1");              // same message for every failure: no account enumeration
  }
  await auditAdmin(staff.id, "admin.login", "staff", staff.id);
  redirect("/admin");
}

export async function logoutAction() {
  await (await authClient()).auth.signOut();
  redirect("/admin/login");
}
