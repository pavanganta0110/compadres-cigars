import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** A leftover merge-conflict marker breaks the build (CSS and SQL are not caught by typecheck or lint), so fail fast and name the file. */
describe("repository hygiene", () => {
  it("no tracked text file contains a merge-conflict marker", () => {
    const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter((f) => /\.(ts|tsx|css|sql|md|mjs|json|yml|yaml)$/.test(f) && !f.includes("package-lock"));
    const bad = files.filter((f) => { try { return /^(<<<<<<< |=======$|>>>>>>> )/m.test(readFileSync(f, "utf8")); } catch { return false; } });
    expect(bad).toEqual([]);
  });
});
