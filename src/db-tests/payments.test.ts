import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { isPaid, STATUS_AFTER_PAYMENT } from "@/lib/domain/operations";
import { freshDb } from "./harness";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); }, 60_000);

type R = Record<string, unknown>;
const call = async (sql: string, params: unknown[]) => (await db.query<{ r: R }>(`select ${sql} as r`, params)).rows[0].r;
async function pendingOrder(total = 10000): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into orders(email, status, subtotal_cents, shipping_cents, tax_cents, total_cents) values ('b@example.com','pending',$1,0,0,$1) returning id", [total]);
  return rows[0].id;
}
const begin = async (order: string) => call("begin_payment($1, 'mock', 'mock')", [order]);
const one = async <T = R>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];

describe("begin_payment / complete_payment", () => {
  it("claims a pending order once: a second concurrent attempt is refused (no double charge)", async () => {
    const o = await pendingOrder();
    const [a, b] = await Promise.all([begin(o), begin(o)]).catch(async () => [await begin(o), await begin(o)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect([a, b].find((x) => !x.ok)).toMatchObject({ code: "payment_in_progress" });
  });
  it("capture moves pending -> a paid status, sets paid_at, and writes an audit event", async () => {
    const o = await pendingOrder();
    const b = await begin(o);
    expect(await call("complete_payment($1, 'ch_1')", [b.payment_id])).toMatchObject({ ok: true });
    const row = await one<{ status: string; paid_at: string | null; payment_reference: string }>("select status, paid_at, payment_reference from orders where id = $1", [o]);
    expect(isPaid(row.status)).toBe(true);
    expect(row.status).toBe(STATUS_AFTER_PAYMENT);
    expect(row.paid_at).not.toBeNull();
    expect(row.payment_reference).toBe("ch_1");
    expect((await db.query("select 1 from audit_log where action = 'payment.captured'")).rows).toHaveLength(1);
  });
  it("a paid order cannot be charged again", async () => {
    const o = await pendingOrder();
    await call("complete_payment($1, 'ch_1')", [(await begin(o)).payment_id]);
    expect(await begin(o)).toMatchObject({ ok: false, code: "already_paid" });
  });
  it("a declined attempt leaves the order pending and allows a retry", async () => {
    const o = await pendingOrder();
    const b = await begin(o);
    await db.query("update payments set status = 'declined', decline_code = 'declined' where id = $1", [b.payment_id]);
    expect((await one<{ status: string }>("select status from orders where id = $1", [o])).status).toBe("pending");
    expect(await begin(o)).toMatchObject({ ok: true, attempt: 2 });
  });
  it("is not callable by anon or authenticated", async () => {
    const o = await pendingOrder();
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(db.query("select begin_payment($1, 'mock', 'mock')", [o])).rejects.toThrow();
      await expect(db.query("select * from payments")).rejects.toThrow();
      await expect(db.query("select * from payment_credentials")).rejects.toThrow();
      await db.exec("reset role");
    }
  });
});

describe("refunds", () => {
  async function captured(total = 10000) {
    const o = await pendingOrder(total);
    const b = await begin(o);
    await call("complete_payment($1, 'ch_1')", [b.payment_id]);
    return o;
  }
  const refund = (o: string, cents: number) => call("begin_refund($1, $2, 'test', null)", [o, cents]);

  it("rejects non-positive amounts and amounts above what was captured", async () => {
    const o = await captured();
    expect(await refund(o, 0)).toMatchObject({ ok: false, code: "invalid_amount" });
    expect(await refund(o, -5)).toMatchObject({ ok: false, code: "invalid_amount" });
    expect(await refund(o, 10001)).toMatchObject({ ok: false, code: "exceeds_captured", refundable_cents: 10000 });
  });
  it("reserves the amount while pending so two clicks cannot exceed the total", async () => {
    const o = await captured();
    expect(await refund(o, 6000)).toMatchObject({ ok: true });
    expect(await refund(o, 6000)).toMatchObject({ ok: false, code: "exceeds_captured", refundable_cents: 4000 });
  });
  it("a failed refund releases the reservation", async () => {
    const o = await captured();
    const r = await refund(o, 6000);
    await call("finish_refund($1, false, null, 'provider_error')", [r.refund_id]);
    expect(await refund(o, 10000)).toMatchObject({ ok: true });
  });
  it("partial refunds keep the order paid; the full amount moves it to refunded", async () => {
    const o = await captured();
    const r1 = await refund(o, 4000);
    expect(await call("finish_refund($1, true, 'rf_1', null)", [r1.refund_id])).toMatchObject({ ok: true, fully_refunded: false });
    expect((await one<{ status: string }>("select status from orders where id = $1", [o])).status).toBe("processing");
    const r2 = await refund(o, 6000);
    expect(await call("finish_refund($1, true, 'rf_2', null)", [r2.refund_id])).toMatchObject({ ok: true, fully_refunded: true });
    expect((await one<{ status: string }>("select status from orders where id = $1", [o])).status).toBe("refunded");
    expect(isPaid("refunded")).toBe(true);
    expect(Number((await one<{ n: string }>("select sum(amount_cents) n from refunds where status = 'completed'")).n)).toBe(10000);
    expect(await refund(o, 1)).toMatchObject({ ok: false });
  });
  it("a refund cannot be finished twice", async () => {
    const o = await captured();
    const r = await refund(o, 100);
    await call("finish_refund($1, true, 'rf_1', null)", [r.refund_id]);
    expect(await call("finish_refund($1, true, 'rf_1', null)", [r.refund_id])).toMatchObject({ ok: false, code: "bad_refund_state" });
  });
  it("an order that was never paid has nothing to refund", async () => {
    expect(await refund(await pendingOrder(), 100)).toMatchObject({ ok: false, code: "nothing_to_refund" });
  });
});

describe("webhook idempotency", () => {
  it("claims an event id only once per provider", async () => {
    const claim = async (p: string, id: string) => (await db.query<{ r: boolean }>("select claim_payment_event($1,$2,'t') as r", [p, id])).rows[0].r;
    expect(await claim("mock", "evt_1")).toBe(true);
    expect(await claim("mock", "evt_1")).toBe(false);
    expect(await claim("quickbooks", "evt_1")).toBe(true);
  });
});
