"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isTrackingNumber } from "@/lib/domain/operations";
import { parseDollarsToCents } from "@/lib/payments/refund";
import { serviceClient } from "@/lib/server/db";
import { auditAdmin, requireStaff } from "@/lib/server/staff";
import { refundOrder } from "@/lib/server/refund-service";
import { refreshTracking } from "@/lib/server/tracking-sync";

const Ids = z.array(z.string().uuid()).min(1).max(200);

/** Only orders currently 'processing' (paid, not yet packed) can be packed. Every bulk action is audited. */
export async function markPackedAction(formData: FormData) {
  const staff = await requireStaff("fulfill");
  const ids = Ids.safeParse(formData.getAll("orderId"));
  if (!ids.success) redirect("/admin");
  const { data } = await serviceClient().from("orders").update({ status: "packed", packed_at: new Date().toISOString() })
    .in("id", ids.data).eq("status", "processing").select("id, number");
  await auditAdmin(staff.id, "orders.marked_packed", "orders", null, { requested: ids.data.length, packed: data?.length ?? 0, numbers: (data ?? []).map((o) => o.number) });
  revalidatePath("/admin");
  redirect("/admin");
}

/** Staff create the label in FedEx, then record the tracking number here. */
export async function saveTrackingAction(formData: FormData) {
  const staff = await requireStaff("fulfill");
  const id = z.string().uuid().safeParse(formData.get("orderId"));
  const tracking = String(formData.get("tracking") ?? "").trim();
  if (!id.success) redirect("/admin/orders");
  if (!isTrackingNumber(tracking)) redirect(`/admin/orders/${id.data}?error=tracking`);
  const { data } = await serviceClient().from("orders").update({ tracking_number: tracking })
    .eq("id", id.data).in("status", ["packed", "completed"]).select("number").maybeSingle();
  if (!data) redirect(`/admin/orders/${id.data}?error=status`);
  await auditAdmin(staff.id, "order.tracking_recorded", "orders", id.data, { tracking_length: tracking.length });
  await refreshTracking({ orderId: id.data }).catch(() => undefined);   // best effort; never blocks saving
  revalidatePath(`/admin/orders/${id.data}`);
  redirect(`/admin/orders/${id.data}?saved=1`);
}

/** Staff refund (owner/manager only). The processor performs it; the amount is validated here and again in SQL. */
export async function refundAction(formData: FormData) {
  const staff = await requireStaff("refund");
  const id = z.string().uuid().safeParse(formData.get("orderId"));
  if (!id.success) redirect("/admin/orders");
  const cents = parseDollarsToCents(String(formData.get("amount") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  const back = (q: string) => redirect(`/admin/orders/${id.data}?${q}`);
  if (cents === null) back("refund=invalid_amount");
  if (reason.length < 3) back("refund=reason_required");
  const r = await refundOrder({ orderId: id.data, amountCents: cents!, reason, staffId: staff.id });
  revalidatePath(`/admin/orders/${id.data}`);
  revalidatePath("/admin");
  back(r.ok ? "refund=ok" : `refund=${encodeURIComponent(r.code)}`);
}
