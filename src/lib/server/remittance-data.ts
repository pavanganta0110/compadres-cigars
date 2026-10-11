import "server-only";
import { outstandingByState, type OutstandingRow, type Remittance } from "@/lib/domain/taxRemittance";
import { serviceClient } from "./db";
import { taxReportFor } from "./report-data";

export async function loadRemittances(limit = 200) {
  const { data, error } = await serviceClient().from("tax_remittances")
    .select("id, state, period_from, period_to, amount_cents, paid_on, method, confirmation, note, created_at, voided_at")
    .order("paid_on", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, state: String(r.state).trim() }));
}

/** All-time estimated tax collected per state minus recorded payments. */
export async function outstandingTax(): Promise<OutstandingRow[]> {
  const all = await taxReportFor(new Date("2020-01-01T00:00:00Z"), new Date(Date.now() + 86400_000));
  const { data, error } = await serviceClient().from("tax_remittances").select("state, amount_cents, voided_at");
  if (error) throw error;
  return outstandingByState(all.rows, ((data ?? []) as Remittance[]).map((r) => ({ ...r, state: String(r.state).trim() })));
}
