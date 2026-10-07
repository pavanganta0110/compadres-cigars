"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";

const Form = z.object({ state: z.string().regex(/^[A-Z]{2}$/), status: z.enum(["allowed", "blocked"]), note: z.string().trim().max(300).optional().default("") });

/** Owner only. Allowing a state needs an explicit confirmation. The DB trigger writes the audit entry with this user as actor. */
export async function setRestrictionAction(formData: FormData) {
  const staff = await requireStaff("manage_restrictions");
  const p = Form.safeParse(Object.fromEntries(formData));
  if (!p.success) redirect("/admin/restrictions?error=invalid");
  if (p.data.status === "allowed" && formData.get("confirm") !== "yes") redirect("/admin/restrictions?error=confirm");
  const { data } = await serviceClient().from("restriction_rules")
    .update({ status: p.data.status, note: p.data.note || null, updated_by: staff.id, updated_at: new Date().toISOString() })
    .eq("state", p.data.state).select("state").maybeSingle();
  if (!data) redirect("/admin/restrictions?error=invalid");
  revalidatePath("/admin/restrictions");
  redirect(`/admin/restrictions?saved=${p.data.state}`);
}
