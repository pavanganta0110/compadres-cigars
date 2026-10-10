"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkPayout, parseRoyaltyPercent } from "@/lib/domain/royalties";
import { parseDollarsToCents } from "@/lib/payments/refund";
import { serviceClient } from "@/lib/server/db";
import { loadRoyalties } from "@/lib/server/royalty-data";
import { requireStaff } from "@/lib/server/staff";

const Brand = z.string().uuid();
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Owner only. A new rate applies to orders PAID on or after the effective date; earlier sales keep the rate they had. */
export async function setRoyaltyRateAction(formData: FormData) {
  const staff = await requireStaff("manage_royalties");
  const brand = Brand.safeParse(formData.get("brandId"));
  const bps = parseRoyaltyPercent(String(formData.get("percent") ?? ""));
  const eff = String(formData.get("effective") ?? "").trim();
  if (!brand.success || bps === null) redirect("/admin/royalties?error=invalid_rate");
  let effective = new Date();
  if (eff) {
    if (!DateOnly.safeParse(eff).success || Number.isNaN(new Date(`${eff}T00:00:00`).getTime())) redirect("/admin/royalties?error=invalid_date");
    effective = new Date(`${eff}T00:00:00`);
  }
  const { error } = await serviceClient().from("brand_royalty_rates").insert({ brand_id: brand.data, rate_bps: bps, effective_from: effective.toISOString(), set_by: staff.id });
  if (error) redirect("/admin/royalties?error=invalid_rate");
  revalidatePath("/admin/royalties"); revalidatePath("/admin");
  redirect("/admin/royalties?saved=rate");
}

/** Records that money was paid to a brand (check, ACH, wire...). It does not send money. Cannot exceed what is currently owed. */
export async function recordPayoutAction(formData: FormData) {
  const staff = await requireStaff("manage_royalties");
  const brand = Brand.safeParse(formData.get("brandId"));
  const cents = parseDollarsToCents(String(formData.get("amount") ?? ""));
  const paidOn = String(formData.get("paidOn") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 120);
  if (!brand.success || !DateOnly.safeParse(paidOn).success) redirect("/admin/royalties?error=invalid_payout");
  const { rows } = await loadRoyalties(null, null);
  const owed = rows.find((r) => r.brandId === brand.data)?.owed ?? 0;
  const check = checkPayout(cents, owed);
  if (!check.ok) redirect(`/admin/royalties?error=${check.code}`);
  const { error } = await serviceClient().from("royalty_payouts").insert({ brand_id: brand.data, amount_cents: cents!, paid_on: paidOn, reference: reference || null, created_by: staff.id });
  if (error) redirect("/admin/royalties?error=invalid_payout");
  revalidatePath("/admin/royalties"); revalidatePath("/admin");
  redirect("/admin/royalties?saved=payout");
}
