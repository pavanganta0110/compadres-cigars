import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { calculateTax } from "@/lib/domain/tax";
import { freshDb } from "./harness";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); }, 60_000);

const future = () => new Date(Date.now() + 3600_000).toISOString();
async function payload(over: Record<string, unknown> = {}, state = "MO", qty = 1, lease = "lease-1") {
  const { rows } = await db.query<{ id: string; price_cents: number }>("select id, price_cents from products where sku = 'ISLEY-PLUG-60X675-10'");
  const p = rows[0];
  const sub = p.price_cents * qty;
  const tax = calculateTax(state, sub);
  return {
    email: "Buyer@Example.com", full_name: "Test Buyer", lease_key: lease, items: [{ product_id: p.id, quantity: qty }],
    address: { state, line1: "1 Main", city: "KC", postal_code: "64131", country: "US" }, shipping: { service: "mock_ground_asr", cents: 1450 },
    expected_subtotal_cents: sub, expected_tax_cents: tax.ok ? tax.snapshot.tax_cents : 0, tax_snapshot: tax.ok ? tax.snapshot : {},
    compliance_snapshot: { version: 1 }, compliance_snapshot_version: 1,
    age: { provider: "self_attestation", reference: "r1", status: "passed", verified_at: new Date().toISOString(), expires_at: future() }, ...over,
  };
}
const call = async (p: unknown) => (await db.query<{ r: Record<string, unknown> }>("select create_checkout_order($1::jsonb) as r", [JSON.stringify(p)])).rows[0].r;
const allow = (s: string) => db.exec(`update restriction_rules set status='allowed' where state='${s}'`);
const count = async (t: string) => Number((await db.query<{ n: string }>(`select count(*) n from ${t}`)).rows[0].n);

describe("schema + seed", () => {
  it("has all 50 tax rates, every state blocked, no DC", async () => {
    expect(await count("tax_rates")).toBe(50);
    expect((await db.query("select 1 from restriction_rules where status <> 'blocked'")).rows).toHaveLength(0);
    expect((await db.query("select 1 from tax_rates where state = 'DC'")).rows).toHaveLength(0);
  });
  it("RLS is enabled on every public table", async () => {
    const { rows } = await db.query("select tablename from pg_tables where schemaname='public' and not rowsecurity");
    expect(rows).toEqual([]);
  });
  it("anon cannot read orders or restriction rules but can read the catalog", async () => {
    await db.exec("set role anon");
    expect((await db.query("select * from brands")).rows.length).toBe(2);
    await expect(db.query("select * from orders")).rejects.toThrow();
    await expect(db.query("select * from restriction_rules")).rejects.toThrow();
    await expect(db.query("select create_checkout_order('{}'::jsonb)")).rejects.toThrow();
    await db.exec("reset role");
  });
});

describe("create_checkout_order", () => {
  it("blocks by default (fail closed), creates nothing, takes no stock", async () => {
    expect(await call(await payload())).toMatchObject({ ok: false, code: "geo_blocked" });
    expect(await count("orders")).toBe(0);
    expect(Number((await db.query<{ s: number }>("select stock s from products where sku='ISLEY-PLUG-60X675-10'")).rows[0].s)).toBe(25);
  });
  it("creates the order, decrements stock, stores snapshot, age record and audit event", async () => {
    await allow("MO");
    const r = await call(await payload());
    expect(r).toMatchObject({ ok: true, total_cents: 14900 + 1450 + 1258 });
    expect((await db.query<{ s: number }>("select stock s from products where sku='ISLEY-PLUG-60X675-10'")).rows[0].s).toBe(24);
    const o = (await db.query<{ status: string; email: string; v: number; adult: boolean }>("select status, email, compliance_snapshot_version v, adult_signature_required adult from orders")).rows[0];
    expect(o).toEqual({ status: "pending", email: "buyer@example.com", v: 1, adult: true });
    expect(await count("age_verifications")).toBe(1);
    expect((await db.query("select 1 from audit_log where action='checkout.order_created'")).rows).toHaveLength(1);
  });
  it("rejects age that is not passed or already expired", async () => {
    await allow("MO");
    const base = (await payload()).age;
    expect(await call(await payload({ age: { ...base, status: "pending" } }))).toMatchObject({ code: "age_not_verified" });
    expect(await call(await payload({ age: { ...base, expires_at: new Date(Date.now() - 1000).toISOString() } }, "MO", 1, "l2"))).toMatchObject({ code: "age_not_verified" });
    expect(await count("orders")).toBe(0);
  });
  it("rejects tampered prices or tax and oversell", async () => {
    await allow("MO");
    expect(await call(await payload({ expected_subtotal_cents: 100 }, "MO", 1, "a"))).toMatchObject({ code: "price_changed" });
    expect(await call(await payload({ expected_tax_cents: 0 }, "MO", 1, "b"))).toMatchObject({ code: "tax_mismatch" });
    expect(await call(await payload({}, "MO", 26, "c"))).toMatchObject({ code: "stock_unavailable" });
    expect(await count("orders")).toBe(0);
  });
  it("duplicate submit with the same lease returns duplicate_order and sells once", async () => {
    await allow("MO");
    const first = await call(await payload());
    const second = await call(await payload());
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, code: "duplicate_order", order_id: first.order_id });
    expect(await count("orders")).toBe(1);
    expect((await db.query<{ s: number }>("select stock s from products where sku='ISLEY-PLUG-60X675-10'")).rows[0].s).toBe(24);
  });
  it("a different checkout session may buy the same cart", async () => {
    await allow("MO");
    expect((await call(await payload({}, "MO", 1, "sess-a"))).ok).toBe(true);
    expect((await call(await payload({}, "MO", 1, "sess-b"))).ok).toBe(true);
  });
});

describe("service_role privileges (hosted Supabase does not grant these by default)", () => {
  it("server can read/write app tables and call the order function; browsers cannot touch staff or orders", async () => {
    await db.exec("insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000aa')");
    await db.exec("set role service_role");
    await db.exec("insert into staff(user_id, role) values ('00000000-0000-4000-8000-0000000000aa', 'owner')");
    expect((await db.query("select * from orders")).rows).toEqual([]);
    await db.exec("update restriction_rules set status = 'blocked' where state = 'MO'");
    await db.exec("insert into audit_log(actor, action) values ('system', 'test')");
    await db.exec("reset role");
    await db.exec("set role authenticated");
    await expect(db.exec("insert into staff(user_id, role) values ('00000000-0000-4000-8000-0000000000bb', 'owner')")).rejects.toThrow();
    await expect(db.query("select * from audit_log")).rejects.toThrow();
    await db.exec("reset role");
  });
});

describe("immutability + audit", () => {
  it("compliance snapshot cannot change once written; audit_log is append-only", async () => {
    await allow("MO");
    await call(await payload());
    await expect(db.exec(`update orders set compliance_snapshot = '{"version":2}'::jsonb`)).rejects.toThrow(/immutable/);
    await expect(db.exec("delete from audit_log")).rejects.toThrow(/append-only/);
    await expect(db.exec("update audit_log set actor='x'")).rejects.toThrow(/append-only/);
  });
  it("changing a restriction rule writes an audit entry", async () => {
    await allow("TX");
    expect((await db.query("select 1 from audit_log where action='restriction.changed' and entity_id='TX'")).rows.length).toBeGreaterThan(0);
  });
});

describe("tax remittance ledger", () => {
  const insert = () => db.exec(`insert into tax_remittances(state, period_from, period_to, amount_cents, paid_on, method) values ('MO','2026-10-01','2026-10-31',1234,'2026-11-10','state_portal')`);
  it("records a payment with an audit entry and refuses unknown states", async () => {
    await insert();
    expect((await db.query("select 1 from audit_log where action='tax.remittance_recorded'")).rows).toHaveLength(1);
    await expect(db.exec(`insert into tax_remittances(state, period_from, period_to, amount_cents, paid_on) values ('DC','2026-10-01','2026-10-31',100,'2026-11-10')`)).rejects.toThrow();
    await expect(db.exec(`insert into tax_remittances(state, period_from, period_to, amount_cents, paid_on) values ('MO','2026-10-31','2026-10-01',100,'2026-11-10')`)).rejects.toThrow();
    await expect(db.exec(`insert into tax_remittances(state, period_from, period_to, amount_cents, paid_on) values ('MO','2026-10-01','2026-10-31',0,'2026-11-10')`)).rejects.toThrow();
  });
  it("is append-only: amounts cannot change and rows cannot be deleted, but a mistake can be voided once", async () => {
    await insert();
    await expect(db.exec("update tax_remittances set amount_cents = 1")).rejects.toThrow(/append-only/);
    await expect(db.exec("delete from tax_remittances")).rejects.toThrow(/append-only/);
    await db.exec("update tax_remittances set voided_at = now()");
    expect((await db.query("select 1 from audit_log where action='tax.remittance_voided'")).rows).toHaveLength(1);
    await expect(db.exec("update tax_remittances set voided_at = null")).rejects.toThrow();
  });
  it("browsers cannot read it; the server can", async () => {
    await insert();
    await db.exec("set role anon");
    await expect(db.query("select * from tax_remittances")).rejects.toThrow();
    await db.exec("reset role"); await db.exec("set role service_role");
    expect((await db.query("select * from tax_remittances")).rows).toHaveLength(1);
    await db.exec("reset role");
  });
});
