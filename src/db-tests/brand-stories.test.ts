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
    expect(await paths()).toContain("/images/compadres-maduro-torpedo-4pk.png"); // later migrations add more photos, so no exact count here
  });
  it("the Robusto and Maduro Torpedo box photos point at the new files and the migration is safe to run twice", async () => {
    const sql = readFileSync("supabase/migrations/20261103000028_compadres_box_photos.sql", "utf8");
    const first = async (sku: string) => (await db.query<{ path: string }>("select i.path from product_images i join products p on p.id = i.product_id where p.sku = $1 order by i.position limit 1", [sku])).rows[0]?.path;
    expect(await first("LION-ROBUSTO-50X5-20")).toBe("/images/compadres-robusto-box-20.png");
    expect(await first("LION-MADTORPEDO-52X6-20")).toBe("/images/compadres-maduro-torpedo-box-20.png");
    await db.exec(sql); await db.exec(sql);
    expect(await first("LION-ROBUSTO-50X5-20")).toBe("/images/compadres-robusto-box-20.png");
  });
  it("Gran Corona gets the box-and-cigar photo first and Maduro Torpedo gets a third photo, safely run twice", async () => {
    const sql = readFileSync("supabase/migrations/20261103000029_gran_corona_and_torpedo_photos.sql", "utf8");
    const paths = async (sku: string) => (await db.query<{ path: string }>("select i.path from product_images i join products p on p.id = i.product_id where p.sku = $1 order by i.position", [sku])).rows.map((r) => r.path);
    expect((await paths("LION-GRANCORONA-60X6-20"))[0]).toBe("/images/compadres-gran-corona-box-20.png"); // superseded by the studio photo set
    expect(await paths("LION-MADTORPEDO-52X6-20")).toContain("/images/compadres-torpedo-box-cigar.jpg");
    await db.exec(sql); await db.exec(sql);
    expect(await paths("LION-MADTORPEDO-52X6-20")).toContain("/images/compadres-torpedo-box-cigar.jpg");
  });
  it("the studio photo set: every Compadres product leads with a sharp photo, has the expected photos, and the migration is safe to run twice", async () => {
    const sql = readFileSync("supabase/migrations/20261103000030_compadres_product_photo_set.sql", "utf8");
    const paths = async (sku: string) => (await db.query<{ path: string }>("select i.path from product_images i join products p on p.id = i.product_id where p.sku = $1 order by i.position", [sku])).rows.map((r) => r.path);
    const expected: Record<string, [string, number]> = {
      "LION-ROBUSTO-50X5-20": ["/images/compadres-robusto-box-20.png", 5],
      "LION-MADTORPEDO-52X6-20": ["/images/compadres-maduro-torpedo-box-20.png", 6],
      "LION-BELICOSO-50X525-20": ["/images/compadres-belicoso-box-20.png", 3],
      "LION-GRANCORONA-60X6-20": ["/images/compadres-gran-corona-box-20.png", 4],
      "LION-DMTORO-52X6-20": ["/images/compadres-double-maduro-toro-box-20.png", 4],
      "LION-CIGARILLO-VANILLA-10": ["/images/compadres-cigarillo-vanilla-studio.jpg", 2],
      "LION-CIGARILLO-COGNAC-10": ["/images/compadres-cigarillo-cognac-studio.jpg", 2],
      "LION-CIGARILLO-CHERRY-10": ["/images/compadres-cigarillo-cherry-studio.jpg", 1],
      "LION-CIGARILLO-CHOCOLATE-10": ["/images/compadres-cigarillo-chocolate-studio.jpg", 1],
    };
    for (const twice of [false, true]) {
      if (twice) { await db.exec(sql); await db.exec(sql); }
      for (const [sku, [lead, count]] of Object.entries(expected)) {
        const p = await paths(sku);
        expect(p[0], sku).toBe(lead);
        expect(p, sku).toHaveLength(count);
      }
    }
  });
  it("the Double Maduro Toro four-pack is the sharp artwork and the Variety cigarillo has the flavor stack, safely run twice", async () => {
    const sql = readFileSync("supabase/migrations/20261103000031_toro_4pk_and_cigarillo_stack.sql", "utf8");
    const paths = async (sku: string) => (await db.query<{ path: string }>("select i.path from product_images i join products p on p.id = i.product_id where p.sku = $1 order by i.position", [sku])).rows.map((r) => r.path);
    for (const twice of [false, true]) {
      if (twice) { await db.exec(sql); await db.exec(sql); }
      expect(await paths("LION-DMTORO-52X6-20")).toContain("/images/compadres-double-maduro-toro-4pk.png");
      expect(await paths("LION-DMTORO-52X6-20")).not.toContain("/images/compadres-double-maduro-toro-4pk.jpg");
      expect(await paths("LION-CIGARILLO-VARIETY-10")).toEqual(["/images/compadres-cigarillo-stack.jpg"]);
    }
  });
  it("the website composites: Robusto and Gran Corona four-packs and the Robusto and Torpedo box composites, safely run twice", async () => {
    const sql = readFileSync("supabase/migrations/20261103000032_website_composites.sql", "utf8");
    const paths = async (sku: string) => (await db.query<{ path: string }>("select i.path from product_images i join products p on p.id = i.product_id where p.sku = $1 order by i.position", [sku])).rows.map((r) => r.path);
    for (const twice of [false, true]) {
      if (twice) { await db.exec(sql); await db.exec(sql); }
      expect(await paths("LION-ROBUSTO-50X5-20")).toEqual(expect.arrayContaining(["/images/compadres-robusto-4pk-website.png", "/images/compadres-robusto-box-website.png"]));
      expect(await paths("LION-ROBUSTO-50X5-20")).not.toContain("/images/compadres-robusto-4pk.png");
      expect(await paths("LION-GRANCORONA-60X6-20")).toContain("/images/compadres-gran-corona-4pk-website.png");
      expect(await paths("LION-MADTORPEDO-52X6-20")).toContain("/images/compadres-torpedo-box-website.png");
    }
  });
  it("the Espresso cigarillo is hidden and the other cigarillo flavors stay active", async () => {
    const sql = readFileSync("supabase/migrations/20261103000033_hide_espresso_cigarillo.sql", "utf8");
    const active = async (sku: string) => (await db.query<{ active: boolean }>("select active from products where sku = $1", [sku])).rows[0]?.active;
    for (const twice of [false, true]) {
      if (twice) { await db.exec(sql); await db.exec(sql); }
      expect(await active("LION-CIGARILLO-ESPRESSO-10")).toBe(false);
      for (const sku of ["LION-CIGARILLO-VANILLA-10", "LION-CIGARILLO-CHERRY-10", "LION-CIGARILLO-COGNAC-10", "LION-CIGARILLO-CHOCOLATE-10", "LION-CIGARILLO-VARIETY-10"]) expect(await active(sku), sku).toBe(true);
    }
  });
  it("Ronald Isley The Plug always ends up with its real photos, even if none are left, safely run twice", async () => {
    const sql = readFileSync("supabase/migrations/20261103000034_isley_real_photos.sql", "utf8");
    const paths = async () => (await db.query<{ path: string }>("select i.path from product_images i join products p on p.id = i.product_id where p.sku = 'ISLEY-PLUG-60X675-10' order by i.position")).rows.map((r) => r.path);
    await db.exec("delete from product_images where product_id in (select id from products where sku = 'ISLEY-PLUG-60X675-10')");
    expect(await paths()).toEqual([]);
    await db.exec(sql); await db.exec(sql);
    expect(await paths()).toEqual(["/images/isley-box-open.jpg", "/images/isley-cigar-wide.jpg", "/images/isley-box-spine.jpg"]);
  });
  it("Jet Smoke Cigars is a brand with a story, no products yet, and the migration is safe to run twice", async () => {
    const sql = readFileSync("supabase/migrations/20261103000035_jet_smoke_brand.sql", "utf8");
    await db.exec(sql); await db.exec(sql);
    const { rows } = await db.query<{ name: string; tagline: string; story: string; template: string; active: boolean }>("select name, tagline, story, template, active from brands where slug = 'jet-smoke-cigars'");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Jet Smoke Cigars", tagline: "Premium Cigars for Champions", template: "default", active: true });
    expect(rows[0].story).toContain("Jason “The Jet” Terry");
    expect((await db.query("select 1 from products p join brands b on b.id = p.brand_id where b.slug = 'jet-smoke-cigars'")).rows).toHaveLength(0);
  });
  it("the Compadres story is about the cigars only, and the migration leaves an admin-edited story alone", async () => {
    const sql = readFileSync("supabase/migrations/20261103000036_compadres_story_cigars_only.sql", "utf8");
    expect(await story("compadres-cigars")).not.toContain("GEO Foods");
    expect(await story("compadres-cigars")).toContain("Gran Corona");
    await db.exec(sql); await db.exec(sql);
    expect(await story("compadres-cigars")).not.toContain("Spencer Woodard");
    await db.exec("update brands set story = 'Edited in the admin.' where slug = 'compadres-cigars'");
    await db.exec(sql);
    expect(await story("compadres-cigars")).toBe("Edited in the admin.");
    // and from the earlier long version it is replaced
    await db.exec("update brands set story = 'Compadres Cigars is a division of GEO Foods.' where slug = 'compadres-cigars'");
    await db.exec(sql);
    expect(await story("compadres-cigars")).toContain("Main Line");
  });
});
