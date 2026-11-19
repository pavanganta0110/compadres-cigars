"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enqueue, processOutbox } from "@/lib/server/email-service";
import { serviceClient } from "@/lib/server/db";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

const SITE = (process.env.COMPADRES_SITE_URL ?? "").trim().replace(/\/+$/, "") || undefined;
const ITEMS = [{ name: "Sample cigar box (test)", quantity: 1, unit_price_cents: 21999 }];
const ADDRESS = { recipient: "Test Customer", line1: "123 Sample St", city: "Kansas City", state: "MO", postal_code: "64111" };
const ORDER = { orderId: "00000000-0000-0000-0000-000000000000", number: 0, name: "Test Customer", items: ITEMS, subtotal_cents: 21999, shipping_cents: 3553, tax_cents: 1857, total_cents: 27409, address: ADDRESS, siteUrl: SITE };

/** Sample data for each email type. Everything here is made up: no real order or customer is touched. */
const SAMPLES = {
  admin_test: (by: string) => ({ sentBy: by }),
  order_confirmation: () => ORDER,
  order_shipped: () => ({ ...ORDER, tracking: "123456789012", service: "FedEx Home Delivery" }),
  refund_issued: () => ({ orderId: ORDER.orderId, number: 0, name: "Test Customer", amount_cents: 27409, fully: true, siteUrl: SITE }),
  admin_new_order: () => ({ orderId: ORDER.orderId, number: 0, total_cents: 27409, state: "MO", items: ITEMS, siteUrl: SITE }),
  admin_low_stock: () => ({ name: "Sample cigar box (test)", sku: "TEST-SKU", stock: 2, threshold: 5, state: "low" as const, siteUrl: SITE }),
  admin_needs_review: () => ({ what: "This is a test of the needs-review email", siteUrl: SITE }),
} as const;
type SampleKind = keyof typeof SAMPLES;
const Kind = z.enum(Object.keys(SAMPLES) as [SampleKind, ...SampleKind[]]);

/** Sends a sample of the chosen email type to the typed address, or to the signed-in staff member's own address when left empty. */
export async function sendTestEmailAction(formData: FormData) {
  const staff = await requireStaff("manage_email");
  const kind = Kind.safeParse(formData.get("kind")).data ?? "admin_test";
  // Optional "send to": staff with email permission only. Empty means the signed-in staff member's own address.
  const typed = z.string().trim().toLowerCase().email().max(254).safeParse(formData.get("to"));
  const to = typed.success ? typed.data : staff.email;
  await enqueue(kind, `${kind}_test:${staff.id}:${Date.now()}`, to, SAMPLES[kind](to));
  const r = await processOutbox(5);
  await auditAdmin(staff.id, "email.test_sent", "email", null, { kind, to_other: to !== staff.email, ...r });
  revalidatePath("/admin/emails");
  redirect("/admin/emails");
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
