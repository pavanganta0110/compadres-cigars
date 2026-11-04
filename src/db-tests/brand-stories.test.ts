import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./harness";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); }, 60_000);
const story = async (slug: string) => (await db.query<{ story: string | null }>("select story from brands where slug = $1", [slug])).rows[0]?.story ?? null;

describe("brand stories", () => {
  it("Sugarhill has real copy (no draft placeholder) and Compadres has its story", async () => {
    expect(await story("sugarhill")).toContain("Englewood, New Jersey");
    expect(await story("sugarhill")).not.toContain("Draft copy");
    expect(await story("compadres-cigars")).toContain("Tamboril");
  });
  it("the migration is safe to run twice and leaves admin-edited stories alone", async () => {
    const sql = readFileSync("supabase/migrations/20261103000026_compadres_sugarhill_stories.sql", "utf8");
    await db.exec("update brands set story = 'Edited in the admin.' where slug in ('compadres-cigars', 'sugarhill')");
    await db.exec(sql); await db.exec(sql);
    expect(await story("sugarhill")).toBe("Edited in the admin.");
    expect(await story("compadres-cigars")).toBe("Edited in the admin.");
  });
  it("fills an empty Compadres story and the Sugarhill placeholder", async () => {
    const sql = readFileSync("supabase/migrations/20261103000026_compadres_sugarhill_stories.sql", "utf8");
    await db.exec("update brands set story = null where slug = 'compadres-cigars'; update brands set story = 'Draft copy, pending client approval.\n\nold' where slug = 'sugarhill'");
    await db.exec(sql);
    expect(await story("compadres-cigars")).toContain("GEO Foods");
    expect(await story("sugarhill")).toContain("Sugar Hill neighborhood of Harlem");
  });
  it("the Maduro Torpedo four-pack photo points at the new artwork and the migration is safe to run twice", async () => {
    const sql = readFileSync("supabase/migrations/20261103000027_maduro_torpedo_4pk_photo.sql", "utf8");
    const paths = async () => (await db.query<{ path: string }>("select i.path from product_images i join products p on p.id = i.product_id where p.sku = 'LION-MADTORPEDO-52X6-20' order by i.position")).rows.map((r) => r.path);
    expect(await paths()).toContain("/images/compadres-maduro-torpedo-4pk.png");
    expect(await paths()).not.toContain("/images/compadres-maduro-torpedo-pack.jpg");
    await db.exec(sql); await db.exec(sql);
    expect(await paths()).toHaveLength(2);
  });
  it("the Robusto and Maduro Torpedo box photos point at the new files and the migration is safe to run twice", async () => {
    const sql = readFileSync("supabase/migrations/20261103000028_compadres_box_photos.sql", "utf8");
    const first = async (sku: string) => (await db.query<{ path: string }>("select i.path from product_images i join products p on p.id = i.product_id where p.sku = $1 order by i.position limit 1", [sku])).rows[0]?.path;
    expect(await first("LION-ROBUSTO-50X5-20")).toBe("/images/compadres-robusto-box-20.png");
    expect(await first("LION-MADTORPEDO-52X6-20")).toBe("/images/compadres-maduro-torpedo-box-20.png");
    await db.exec(sql); await db.exec(sql);
    expect(await first("LION-ROBUSTO-50X5-20")).toBe("/images/compadres-robusto-box-20.png");
  });
});
