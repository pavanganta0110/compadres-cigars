"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serviceClient } from "@/lib/server/db";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

const Form = z.object({ userId: z.string().uuid(), role: z.enum(["owner", "manager", "fulfillment", "viewer"]) });

async function ownerCount() {
  const { count } = await serviceClient().from("staff").select("*", { count: "exact", head: true }).eq("role", "owner");
  return count ?? 0;
}

export async function changeRoleAction(formData: FormData) {
  const staff = await requireStaff("manage_users");
  const p = Form.safeParse(Object.fromEntries(formData));
  if (!p.success) redirect("/admin/users?error=invalid");
  const { data: current } = await serviceClient().from("staff").select("role").eq("user_id", p.data.userId).maybeSingle();
  if (current?.role === "owner" && p.data.role !== "owner" && (await ownerCount()) <= 1) redirect("/admin/users?error=last_owner");
  await serviceClient().from("staff").update({ role: p.data.role }).eq("user_id", p.data.userId);
  await auditAdmin(staff.id, "staff.role_changed", "staff", p.data.userId, { from: current?.role, to: p.data.role });
  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}

export async function removeStaffAction(formData: FormData) {
  const staff = await requireStaff("manage_users");
  const id = z.string().uuid().safeParse(formData.get("userId"));
  if (!id.success) redirect("/admin/users?error=invalid");
  if (id.data === staff.id) redirect("/admin/users?error=self");
  await serviceClient().from("staff").delete().eq("user_id", id.data);
  await auditAdmin(staff.id, "staff.removed", "staff", id.data);
  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}
