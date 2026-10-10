import { NextResponse } from "next/server";
import { toCsv } from "@/lib/domain/csv";
import { serviceClient } from "@/lib/server/db";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

/** Owner/manager only. Includes the marketing-consent columns so a mailing can be limited to people who agreed. Erased customers are excluded. */
export async function GET(req: Request) {
  const staff = await requireStaff("export_customers");
  const marketingOnly = new URL(req.url).searchParams.get("filter") === "marketing";
  let q = serviceClient().from("customers").select("email, full_name, created_at, marketing_opt_in, marketing_opt_in_at, marketing_opt_in_source, marketing_opt_out_at, orders(id)").is("erased_at", null).order("created_at", { ascending: true }).limit(50000);
  if (marketingOnly) q = q.eq("marketing_opt_in", true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "export_failed" }, { status: 500 });
  const rows: unknown[][] = [
    ["Email", "Name", "Marketing consent", "Consent date", "Consent source", "Unsubscribed on", "Orders", "Customer since"],
    ...(data ?? []).map((c) => [c.email, c.full_name ?? "", c.marketing_opt_in ? "yes" : "no", c.marketing_opt_in_at?.slice(0, 10) ?? "", c.marketing_opt_in_source ?? "", c.marketing_opt_out_at?.slice(0, 10) ?? "", (c.orders as unknown[]).length, c.created_at.slice(0, 10)]),
  ];
  await auditAdmin(staff.id, "customers.exported", "customers", null, { rows: (data ?? []).length, marketingOnly });
  return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
