"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enqueue, processOutbox } from "@/lib/server/email-service";
import { serviceClient } from "@/lib/server/db";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

/** Sends a test email to the signed-in staff member's own address (never to a typed-in recipient). */
export async function sendTestEmailAction() {
  const staff = await requireStaff("manage_email");
  await enqueue("admin_test", `admin_test:${staff.id}:${Date.now()}`, staff.email, { sentBy: staff.email });
  const r = await processOutbox(5);
  await auditAdmin(staff.id, "email.test_sent", "email", null, { ...r });
  revalidatePath("/admin/emails");
  redirect(`/admin/emails?test=${r.sent ? "sent" : r.skipped ? "skipped" : "queued"}`);
}

/** Puts a failed or dead email back in the queue and tries again now. */
export async function retryEmailAction(formData: FormData) {
  const staff = await requireStaff("manage_email");
  const id = z.string().uuid().safeParse(formData.get("emailId"));
  if (!id.success) redirect("/admin/emails");
  await serviceClient().from("email_outbox").update({ status: "queued", attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null }).eq("id", id.data).in("status", ["failed", "dead", "skipped"]);
  await auditAdmin(staff.id, "email.retried", "email", id.data, {});
  await processOutbox(5);
  revalidatePath("/admin/emails");
  redirect("/admin/emails?retried=1");
}
