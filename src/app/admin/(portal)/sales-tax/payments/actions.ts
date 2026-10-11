"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseDollarsToCents } from "@/lib/domain/taxRemittance";
import { serviceClient } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff";

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)));
const Form = z.object({
  state: z.string().regex(/^[A-Z]{2}$/),
  periodFrom: Day, periodTo: Day, paidOn: Day,
  amount: z.string(),
  method: z.enum(["state_portal", "ach", "check", "other"]),
  confirmation: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

/** Records that staff paid a state in that state's own portal. Nothing here moves money. Owner only; audited by the database. */
export async function recordRemittanceAction(formData: FormData) {
  const staff = await requireStaff("manage_tax");
  const p = Form.safeParse(Object.fromEntries(formData));
  const cents = p.success ? parseDollarsToCents(p.data.amount) : null;
  if (!p.success || cents === null || p.data.periodTo < p.data.periodFrom) redirect("/admin/sales-tax/payments?error=invalid");
  const { error } = await serviceClient().from("tax_remittances").insert({
    state: p.data.state, period_from: p.data.periodFrom, period_to: p.data.periodTo, amount_cents: cents, paid_on: p.data.paidOn,
    method: p.data.method, confirmation: p.data.confirmation || null, note: p.data.note || null, created_by: staff.id,
  });
  if (error) redirect("/admin/sales-tax/payments?error=invalid");
  revalidatePath("/admin/sales-tax/payments"); revalidatePath("/admin");
  redirect("/admin/sales-tax/payments?saved=1");
}

export async function voidRemittanceAction(formData: FormData) {
  const staff = await requireStaff("manage_tax");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/sales-tax/payments?error=invalid");
  await serviceClient().from("tax_remittances").update({ voided_at: new Date().toISOString(), voided_by: staff.id }).eq("id", id.data).is("voided_at", null);
  revalidatePath("/admin/sales-tax/payments"); revalidatePath("/admin");
  redirect("/admin/sales-tax/payments?saved=voided");
}
