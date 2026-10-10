import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./harness";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); }, 60_000);
const brand = async (slug = "ronald-isley") => (await db.query<{ id: string }>("select id from brands where slug = $1", [slug])).rows[0].id;
const ACTOR = "00000000-0000-4000-8000-000000000001";

describe("brand royalties tables", () => {
  it("stores a rate history, audits each rate and payout with who did it", async () => {
    const b = await brand();
    await db.query("insert into brand_royalty_rates(brand_id, rate_bps, set_by) values ($1, 1000, $2)", [b, ACTOR]);
    await db.query("insert into royalty_payouts(brand_id, amount_cents, paid_on, reference, created_by) values ($1, 25000, '2026-10-15', 'ACH 1001', $2)", [b, ACTOR]);
    const { rows } = await db.query<{ actor: string; action: string; detail: Record<string, unknown> }>("select actor, action, detail from audit_log where action like 'royalty.%' order by id");
    expect(rows.map((r) => r.action)).toEqual(["royalty.rate_set", "royalty.payout_recorded"]);
    expect(rows.every((r) => r.actor === ACTOR)).toBe(true);
    expect(rows[0].detail).toMatchObject({ rate_bps: 1000 });
    expect(rows[1].detail).toMatchObject({ amount_cents: 25000, reference: "ACH 1001" });
  });
  it("rejects rates outside 0-100% and non-positive payouts", async () => {
    const b = await brand();
    await expect(db.query("insert into brand_royalty_rates(brand_id, rate_bps) values ($1, 10001)", [b])).rejects.toThrow();
    await expect(db.query("insert into brand_royalty_rates(brand_id, rate_bps) values ($1, -1)", [b])).rejects.toThrow();
    await db.query("insert into brand_royalty_rates(brand_id, rate_bps) values ($1, 10000)", [b]);
    await expect(db.query("insert into royalty_payouts(brand_id, amount_cents, paid_on) values ($1, 0, '2026-10-01')", [b])).rejects.toThrow();
    await expect(db.query("insert into royalty_payouts(brand_id, amount_cents, paid_on) values ($1, -5, '2026-10-01')", [b])).rejects.toThrow();
  });
  it("a brand with payouts cannot be deleted (the ledger is kept)", async () => {
    const b = await brand("sugarhill");
    await db.query("insert into royalty_payouts(brand_id, amount_cents, paid_on) values ($1, 100, '2026-10-01')", [b]);
    await db.exec("delete from products where brand_id = (select id from brands where slug = 'sugarhill')");
    await expect(db.query("delete from brands where id = $1", [b])).rejects.toThrow();
  });
  it("is service-role only", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(db.query("select * from brand_royalty_rates")).rejects.toThrow();
      await expect(db.query("select * from royalty_payouts")).rejects.toThrow();
      await expect(db.query("insert into royalty_payouts(brand_id, amount_cents, paid_on) values (gen_random_uuid(), 1, '2026-10-01')")).rejects.toThrow();
      await db.exec("reset role");
    }
  });
});
