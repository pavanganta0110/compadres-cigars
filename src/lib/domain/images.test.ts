import { describe, expect, it } from "vitest";
import { detectImageType, mediaIdFromPath } from "./images";

const bytes = (...n: number[]) => new Uint8Array(n);
describe("image type detection (from the bytes, not the name)", () => {
  it("accepts JPEG, PNG and WebP", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(detectImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
  });
  it("refuses SVG, HTML, scripts, GIF, empty and truncated files", () => {
    for (const s of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "<html></html>", "GIF89a....", "RIFF1234WAVEfmt "]) expect(detectImageType(new TextEncoder().encode(s))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
  });
  it("only recognises our own /media/<uuid> paths", () => {
    const id = "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";
    expect(mediaIdFromPath(`/media/${id}`)).toBe(id);
    for (const p of [`/images/x.jpg`, `/media/${id}/x`, `/media/../etc`, `https://x/media/${id}`, "", null, undefined]) expect(mediaIdFromPath(p)).toBeNull();
  });
});
