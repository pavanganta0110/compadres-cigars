import Link from "next/link";
import { requireStaff } from "@/lib/server/staff";
import { createBrandAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add brand" };

const ERRORS: Record<string, string> = {
  invalid: "Please check the fields and try again.", duplicate: "A brand with that name already exists.",
  image_too_large: "That image is larger than 4 MB.", image_bad_type: "Only JPEG, PNG or WebP images are accepted.", image_error: "The image could not be saved. Please try again.",
};

export default async function NewBrand({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff("manage_products");
  const { error } = await searchParams;
  return (
    <>
      <p><Link href="/admin/brands">&larr; Brands</Link></p>
      <h1>Add a brand</h1>
      <p className="adm-note">New brands are saved as drafts. A draft brand, and every product under it, stays hidden from the store until you publish the brand.</p>
      {error && <p className="adm-alert" role="alert">{ERRORS[error] ?? ERRORS.invalid}</p>}
      <form action={createBrandAction} className="adm-form adm-form-wide">
        <label>Brand name<input name="name" required minLength={2} maxLength={60} /></label>
        <label>Tagline<input name="tagline" maxLength={120} /></label>
        <label>Short description<input name="shortDescription" maxLength={300} /></label>
        <label>Story<textarea name="story" rows={5} maxLength={6000} /></label>
        <div className="adm-row">
          <label>Accent color<input name="accentColor" defaultValue="#d6ad68" pattern="#[0-9a-fA-F]{6}" /></label>
          <label>Banner image (optional)<input name="hero" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          <label>Logo (optional)<input name="logo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        </div>
        <p className="adm-muted">JPEG, PNG or WebP, up to 4 MB each.</p>
        <label className="adm-check"><input type="checkbox" name="publish" />Publish now (visible in the store)</label>
        <p><button className="adm-btn" type="submit">Create brand</button></p>
      </form>
    </>
  );
}
