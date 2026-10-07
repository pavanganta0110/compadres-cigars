import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/server/staff";

/** The operations dashboard (health, fulfillment counts, pack queue, attention list) lives on the main dashboard. */
export default async function Operations() {
  await requireStaff();
  redirect("/admin");
}
