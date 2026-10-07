import { expect, it } from "vitest";
import { formatUsd } from "./money";
it("formats cents", () => {
  expect(formatUsd(14900)).toBe("$149.00");
  expect(formatUsd(5)).toBe("$0.05");
  expect(() => formatUsd(1.5)).toThrow();
});
