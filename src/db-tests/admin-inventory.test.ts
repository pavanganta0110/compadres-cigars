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

describe("media storage", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  it("stores an image and returns it byte for byte; anon cannot touch it", async () => {
    const id = (await db.query<{ id: string }>("select store_media('image/png', $1, null) as id", [png.toString("base64")])).rows[0].id;
    const got = (await db.query<{ m: { content_type: string; b64: string } }>("select get_media($1) as m", [id])).rows[0].m;
    expect(got.content_type).toBe("image/png");
    expect(Buffer.from(got.b64, "base64").equals(png)).toBe(true);
    expect((await db.query("select get_media('00000000-0000-4000-8000-000000000000') as m")).rows[0]).toEqual({ m: null });
    await db.exec("set role anon");
    await expect(db.query("select * from media")).rejects.toThrow();
    await expect(db.query("select get_media($1)", [id])).rejects.toThrow();
    await db.exec("reset role");
  });
  it("rejects other content types and oversize files", async () => {
    await expect(db.query("select store_media('image/svg+xml', 'AAAA', null)")).rejects.toThrow();
    await expect(db.query("select store_media('image/png', $1, null)", [Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64")])).rejects.toThrow();
  });
});

describe("Ronald Isley photography migration", () => {
  it("puts the new photos first, keeps the old ones, and is safe to run again", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/20261010000008_isley_photography.sql", "utf8");
    const paths = async () => (await db.query<{ path: string }>("select path from product_images i join products p on p.id = i.product_id where p.sku = 'ISLEY-PLUG-60X675-10' order by position, path")).rows.map((r) => r.path);
    const before = await paths();
    expect(before[0]).toBe("/images/isley-open-box.jpg");
    await db.exec(sql);
    expect(await paths()).toEqual(before);
    expect((await db.query<{ h: string }>("select hero_path h from brands where slug = 'ronald-isley'")).rows[0].h).toBe("/images/isley-lounge.jpg");
  });
  it("on a database still holding the old gallery it prepends the new photos and keeps the old ones", async () => {
    const { readFileSync } = await import("node:fs");
    await db.exec("delete from product_images where path in ('/images/isley-open-box.jpg','/images/isley-box-and-cigar.jpg','/images/isley-cigar-standing.jpg','/images/isley-box-closed-gold.jpg'); update product_images set position = position - 10 where path like '/images/isley-%' and position >= 10; update brands set hero_path = '/images/isley-box-open.jpg' where slug = 'ronald-isley'");
    await db.exec(readFileSync("supabase/migrations/20261010000008_isley_photography.sql", "utf8"));
    const { rows } = await db.query<{ path: string }>("select path from product_images i join products p on p.id = i.product_id where p.sku = 'ISLEY-PLUG-60X675-10' order by position");
    expect(rows.slice(0, 4).map((r) => r.path)).toEqual(["/images/isley-open-box.jpg", "/images/isley-box-and-cigar.jpg", "/images/isley-cigar-standing.jpg", "/images/isley-box-closed-gold.jpg"]);
    expect(rows.map((r) => r.path)).toEqual(expect.arrayContaining(["/images/isley-box-open.jpg", "/images/isley-cigar.jpg", "/images/isley-box-spine.jpg"]));
    expect(rows).toHaveLength(7);
  });
});
