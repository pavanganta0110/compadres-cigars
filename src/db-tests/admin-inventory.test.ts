import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { ADMIN_OVERRIDE, calculateTax, type TaxRateRow } from "@/lib/domain/tax";
import { freshDb } from "./harness";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); }, 60_000);

describe("editable tax rates", () => {
  it("every rate change is audited with before/after and the editor", async () => {
    await db.exec("update tax_rates set rate_bps = 1000, matrix_sha256 = 'admin-edit', updated_by = '00000000-0000-4000-8000-000000000001' where state = 'MO'");
    const { rows } = await db.query<{ actor: string; detail: { from_bps: number; to_bps: number } }>("select actor, detail from audit_log where action = 'tax.rate_changed'");
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toMatchObject({ from_bps: 844, to_bps: 1000 });
    expect(rows[0].actor).toBe("00000000-0000-4000-8000-000000000001");
    await db.exec("update tax_rates set effective_date = current_date where state = 'MO'");   // no rate change: no audit row
    expect((await db.query("select 1 from audit_log where action = 'tax.rate_changed'")).rows).toHaveLength(1);
  });
  it("the database rejects rates outside 0 to 30 percent", async () => {
    await expect(db.exec("update tax_rates set rate_bps = 3001 where state = 'MO'")).rejects.toThrow();
    await expect(db.exec("update tax_rates set rate_bps = -1 where state = 'MO'")).rejects.toThrow();
  });
  it("create_checkout_order uses the edited rate, and TypeScript agrees with it", async () => {
    await db.exec("update restriction_rules set status = 'allowed' where state = 'MO'; update tax_rates set rate_bps = 1000, matrix_sha256 = 'admin-edit' where state = 'MO'");
    const { rows: [p] } = await db.query<{ id: string; price_cents: number }>("select id, price_cents from products where sku = 'ISLEY-PLUG-60X675-10'");
    const rates = new Map<string, TaxRateRow>((await db.query<{ state: string; rate_bps: number; matrix_sha256: string; effective_date: string }>("select state, rate_bps, matrix_sha256, effective_date::text from tax_rates")).rows.map((r) => [r.state.trim(), { rate_bps: r.rate_bps, source_sha256: r.matrix_sha256, effective_date: r.effective_date }]));
    const tax = calculateTax("MO", p.price_cents, rates);
    if (!tax.ok) throw new Error("tax");
    expect(tax.snapshot.tax_cents).toBe(1490);
    expect(tax.snapshot.source_sha256).toBe(ADMIN_OVERRIDE);
    const payload = {
      email: "b@example.com", full_name: "B", lease_key: "l1", items: [{ product_id: p.id, quantity: 1 }],
      address: { state: "MO", line1: "1 Main", city: "KC", postal_code: "64131", country: "US" }, shipping: { service: "s", cents: 1000 },
      expected_subtotal_cents: p.price_cents, expected_tax_cents: tax.snapshot.tax_cents, tax_snapshot: tax.snapshot, compliance_snapshot: { v: 1 }, compliance_snapshot_version: 1,
      age: { provider: "self_attestation", reference: "r", status: "passed", verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600_000).toISOString() },
    };
    const r = (await db.query<{ r: Record<string, unknown> }>("select create_checkout_order($1::jsonb) as r", [JSON.stringify(payload)])).rows[0].r;
    expect(r).toMatchObject({ ok: true, total_cents: p.price_cents + 1000 + 1490 });
  });
});

describe("low stock threshold", () => {
  it("defaults to 5 and rejects negatives", async () => {
    const { rows } = await db.query<{ t: number }>("select low_stock_threshold t from products limit 1");
    expect(rows[0].t).toBe(5);
    await expect(db.exec("update products set low_stock_threshold = -1")).rejects.toThrow();
  });
});
