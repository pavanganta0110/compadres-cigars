"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ADMIN_OVERRIDE, parsePercentToBps, TAX_EFFECTIVE_DATE, TAX_MATRIX_SHA256, TAX_RATES_BPS } from "@/lib/domain/tax";
import { serviceClient } from "@/lib/server/db";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

const State = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);

/** Owner only. The database trigger audits the before/after rate; this adds who and why. New orders use the new rate at once. */
export async function updateTaxRateAction(formData: FormData) {
  const staff = await requireStaff("manage_tax");
  const state = State.safeParse(formData.get("state"));
  const bps = parsePercentToBps(String(formData.get("percent") ?? ""));
  if (!state.success || bps === null) redirect("/admin/tax-rates?error=invalid");
  const { data, error } = await serviceClient().from("tax_rates")
    .update({ rate_bps: bps, matrix_sha256: ADMIN_OVERRIDE, effective_date: new Date().toISOString().slice(0, 10), updated_by: staff.id, updated_at: new Date().toISOString() })
    .eq("state", state.data).select("state").maybeSingle();
  if (error || !data) redirect("/admin/tax-rates?error=invalid");
  await auditAdmin(staff.id, "tax.rate_edited", "tax_rates", state.data, { to_bps: bps });
  revalidatePath("/admin/tax-rates");
  redirect(`/admin/tax-rates?saved=${state.data}`);
}

/** Puts a state back to the business-approved matrix value. */
export async function resetTaxRateAction(formData: FormData) {
  const staff = await requireStaff("manage_tax");
  const state = State.safeParse(formData.get("state"));
  if (!state.success || !Object.hasOwn(TAX_RATES_BPS, state.data)) redirect("/admin/tax-rates?error=invalid");
  await serviceClient().from("tax_rates")
    .update({ rate_bps: TAX_RATES_BPS[state.data], matrix_sha256: TAX_MATRIX_SHA256, effective_date: TAX_EFFECTIVE_DATE, updated_by: staff.id, updated_at: new Date().toISOString() })
    .eq("state", state.data);
  await auditAdmin(staff.id, "tax.rate_reset", "tax_rates", state.data, { to_bps: TAX_RATES_BPS[state.data] });
  revalidatePath("/admin/tax-rates");
  redirect(`/admin/tax-rates?saved=${state.data}`);
}
