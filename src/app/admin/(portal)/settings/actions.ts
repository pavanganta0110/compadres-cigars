"use server";
import { redirect } from "next/navigation";
import { diagnoseFedEx } from "@/lib/shipping/fedex/diagnose";
import { fetchTransport } from "@/lib/shipping/fedex/client";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

export async function testFedExAction() {
  const staff = await requireStaff("manage_restrictions");
  let d;
  try { d = await diagnoseFedEx(process.env, fetchTransport); }
  catch { d = { ok: false, step: "config" as const, summary: "Could not reach FedEx (network error or timeout)." }; }
  await auditAdmin(staff.id, "shipping.fedex_tested", "settings", null, { ok: d.ok, step: d.step, code: d.fedexCode });
  const q = new URLSearchParams({ ok: d.ok ? "1" : "0", step: d.step, msg: d.summary, ...(d.fedexCode ? { code: d.fedexCode } : {}) });
  redirect(`/admin/settings?${q.toString()}`);
}
