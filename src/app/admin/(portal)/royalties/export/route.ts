import { NextResponse } from "next/server";
import { toCsv } from "@/lib/domain/csv";
import { formatBps } from "@/lib/domain/tax";
import { parsePeriod } from "@/lib/server/report-data";
import { loadRoyalties } from "@/lib/server/royalty-data";
import { auditAdmin, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const staff = await requireStaff("view_royalties");
  const u = new URL(req.url);
  const { from, to } = parsePeriod(u.searchParams.get("from") ?? undefined, u.searchParams.get("to") ?? undefined);
  const { rows } = await loadRoyalties(from, to);
  const usd = (c: number) => (c / 100).toFixed(2);
  const csv = toCsv([
    ["Brand", "Rate (%)", "Units sold", "Net sales (USD)", "Royalty earned (USD)", "Paid out, all time (USD)", "Owed now (USD)"],
    ...rows.map((r) => [r.name, formatBps(r.rateBps), r.period.units, usd(r.period.netCents), usd(r.period.royaltyCents), usd(r.paidOut), usd(r.owed)]),
    [`Period ${from.toISOString().slice(0, 10)} to ${new Date(to.getTime() - 86400_000).toISOString().slice(0, 10)}. Net sales = item subtotal of paid orders, no tax or shipping, minus refunds.`],
  ]);
  await auditAdmin(staff.id, "report.royalties_exported", "report", null, { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), brands: rows.length });
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="royalties-${from.toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
