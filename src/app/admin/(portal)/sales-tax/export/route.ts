import { NextResponse } from "next/server";
import { toCsv } from "@/lib/domain/csv";
import { TAX_REPORT_DISCLAIMER } from "@/lib/domain/taxReport";
import { parsePeriod, taxReportFor } from "@/lib/server/report-data";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const staff = await requireStaff("view_reports");
  const u = new URL(req.url);
  const { from, to } = parsePeriod(u.searchParams.get("from") ?? undefined, u.searchParams.get("to") ?? undefined);
  const r = await taxReportFor(from, to);
  const rows: unknown[][] = [
    ["State", "Orders", "Taxable sales (USD)", "Estimated tax collected (USD)", "Refunds (USD)"],
    ...r.rows.map((x) => [x.state, x.orders, (x.taxable_cents / 100).toFixed(2), (x.tax_estimated_cents / 100).toFixed(2), (x.refunds_cents / 100).toFixed(2)]),
    ["Total", r.totals.orders, (r.totals.taxable_cents / 100).toFixed(2), (r.totals.tax_estimated_cents / 100).toFixed(2), (r.totals.refunds_cents / 100).toFixed(2)],
    [TAX_REPORT_DISCLAIMER],
  ];
  await auditAdmin(staff.id, "report.sales_tax_exported", "report", null, { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), rows: r.rows.length });
  return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="sales-tax-estimate.csv"', "Cache-Control": "no-store" } });
}
