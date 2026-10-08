"use client";
import { useState, type ChangeEvent } from "react";

const MAX_SIDE = 1800;
const LIMIT = 3 * 1024 * 1024;   // stay well under the 4 MB server limit and Vercel's 4.5 MB request cap

async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const q of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= LIMIT) return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  }
  throw new Error("too_big");
}

/** A file input that shrinks big photos in the browser first, so phone photos upload reliably. */
export function ImagePicker({ name, label, required }: { name: string; label: string; required?: boolean }) {
  const [msg, setMsg] = useState("");
  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    setMsg("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMsg("Only JPEG, PNG or WebP images are accepted."); input.value = ""; return; }
    if (file.size <= LIMIT) return;
    try {
      const small = await shrink(file);
      const dt = new DataTransfer(); dt.items.add(small); input.files = dt.files;
      setMsg(`Large photo reduced to ${(small.size / 1024 / 1024).toFixed(1)} MB before upload.`);
    } catch { setMsg("That image is too large. Please choose a smaller one."); input.value = ""; }
  };
  return (
    <label>{label}
      <input name={name} type="file" accept="image/jpeg,image/png,image/webp" required={required} onChange={onChange} />
      {msg && <small role="status" className="adm-muted">{msg}</small>}
    </label>
  );
}
