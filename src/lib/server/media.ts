import "server-only";
import { detectImageType, MAX_IMAGE_BYTES, mediaIdFromPath, mediaPath } from "@/lib/domain/images";
import { serviceClient } from "./db";

export type SaveImage = { ok: true; path: string } | { ok: false; code: "no_file" | "too_large" | "bad_type" | "error" };

/** Callers must have passed requireStaff("manage_products"). */
export async function saveImage(file: FormDataEntryValue | null, actor: string): Promise<SaveImage> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, code: "no_file" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, code: "too_large" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { ok: false, code: "bad_type" };
  const { data, error } = await serviceClient().rpc("store_media", { p_type: type, p_b64: Buffer.from(bytes).toString("base64"), p_actor: actor });
  if (error || typeof data !== "string") return { ok: false, code: "error" };
  return { ok: true, path: mediaPath(data) };
}

/** Removes the stored file behind a /media/<id> path (no-op for other paths such as /images/...). */
export async function deleteImage(path: string | null | undefined) {
  const id = mediaIdFromPath(path);
  if (id) await serviceClient().from("media").delete().eq("id", id);
}

export const IMAGE_ERRORS: Record<string, string> = {
  too_large: "That image is larger than 4 MB. Please use a smaller file.",
  bad_type: "Only JPEG, PNG or WebP images are accepted.",
  error: "The image could not be saved. Please try again.",
};
