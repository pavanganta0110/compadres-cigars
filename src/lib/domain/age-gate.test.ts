import { describe, expect, it } from "vitest";
import { safeNextPath, signAgeToken, verifyAgeToken } from "./age-gate";

const S = "test-secret";
describe("age gate token", () => {
  it("accepts a fresh token", async () => {
    expect(await verifyAgeToken(S, await signAgeToken(S, 1000, 60), 1030)).toBe(true);
  });
  it("rejects expired tokens", async () => {
    expect(await verifyAgeToken(S, await signAgeToken(S, 1000, 60), 1060)).toBe(false);
  });
  it("rejects tampered payload or signature", async () => {
    const t = await signAgeToken(S, 1000, 60);
    const [p, sig] = t.split(".");
    expect(await verifyAgeToken(S, `${Number(p) + 99999}.${sig}`, 1030)).toBe(false);
    expect(await verifyAgeToken(S, `${p}.${sig}x`, 1030)).toBe(false);
  });
  it("rejects wrong secret, missing secret, and junk (fail closed)", async () => {
    const t = await signAgeToken(S, 1000, 60);
    expect(await verifyAgeToken("other", t, 1030)).toBe(false);
    expect(await verifyAgeToken(undefined, t, 1030)).toBe(false);
    expect(await verifyAgeToken(S, undefined, 1030)).toBe(false);
    expect(await verifyAgeToken(S, "garbage", 1030)).toBe(false);
    expect(await verifyAgeToken(S, "true", 1030)).toBe(false);
  });
});
describe("safeNextPath", () => {
  it("blocks open redirects", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/shop")).toBe("/shop");
    expect(safeNextPath(null)).toBe("/");
  });
});
