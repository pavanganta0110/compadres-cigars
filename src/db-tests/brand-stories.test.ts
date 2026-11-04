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
});
