export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** Decides the type from the file's own bytes, never from its name or the browser-supplied type. SVG and everything else is refused. */
export function detectImageType(b: Uint8Array): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export const mediaPath = (id: string) => `/media/${id}`;
export const MEDIA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function mediaIdFromPath(path: string | null | undefined): string | null {
  const m = /^\/media\/([0-9a-f-]{36})$/i.exec(path ?? "");
  return m && MEDIA_ID.test(m[1]) ? m[1] : null;
}
