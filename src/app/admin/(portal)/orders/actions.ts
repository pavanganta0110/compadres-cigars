"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isTrackingNumber } from "@/lib/domain/operations";
import { serviceClient } from "@/lib/server/db";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

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
  revalidatePath(`/admin/orders/${id.data}`);
  redirect(`/admin/orders/${id.data}?saved=1`);
}
