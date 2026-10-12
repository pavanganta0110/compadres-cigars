import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("migration files", () => {
  const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
  it("every file starts with a 14-digit version", () => {
    for (const f of files) expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
  });
  it("versions are unique (Supabase keys migrations by version; a duplicate stops the database from starting)", () => {
    const versions = files.map((f) => f.slice(0, 14));
    const dupes = versions.filter((v, i) => versions.indexOf(v) !== i);
    expect(dupes).toEqual([]);
  });
});
