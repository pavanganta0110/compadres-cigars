import Link from "next/link";
import { can } from "@/lib/domain/permissions";
import { serviceClient } from "@/lib/server/db";
import { ImagePicker } from "@/components/ImagePicker";
import { requireStaff } from "@/lib/server/staff";
import { removeBrandAction, updateBrandAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brands" };

const ERRORS: Record<string, string> = {
  confirm: "Tick the confirmation box to remove a brand.", has_products: "still has products. Remove or move its products first, or unpublish the brand instead.",
  invalid: "That change was not valid.", image_too_large: "That image is larger than 4 MB.", image_bad_type: "Only JPEG, PNG or WebP images are accepted.", image_error: "The image could not be saved. Please try again.",
};

export default async function Brands({ searchParams }: { searchParams: Promise<{ saved?: string; removed?: string; error?: string; n?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const edit = can(staff.role, "manage_products");
  const { data } = await serviceClient().from("brands").select("id, slug, name, tagline, short_description, story, accent_color, active, logo_path, hero_path, products(id)").order("display_order");
  return (
    <>
      <div className="adm-head">
        <h1>Brands</h1>
        {edit && <Link className="adm-btn" href="/admin/brands/new">Add brand</Link>}
      </div>
      {sp.saved && <p className="adm-note" role="status">Saved.</p>}
      {sp.removed && <p className="adm-note" role="status">Brand removed.</p>}
      {sp.error && <p className="adm-alert" role="alert">{sp.error === "has_products" && sp.n ? `${sp.n.slice(0, 60)} ` : ""}{ERRORS[sp.error] ?? ERRORS.invalid}</p>}
      <p className="adm-note">A brand that is not published is hidden from the store together with all of its products.</p>
      <div className="adm-stack">
        {(data ?? []).map((b) => (
          <section key={b.id} className="adm-panel" aria-labelledby={`b-${b.id}`}>
            <h2 id={`b-${b.id}`} className="adm-plain">{b.name} <span className={`adm-pill ${b.active ? "" : "amber"}`}>{b.active ? "Published" : "Draft"}</span></h2>
            <p className="adm-muted">/brands/{b.slug} · {(b.products as unknown[]).length} products</p>
            {edit ? (
              <>
              <form action={updateBrandAction} className="adm-form adm-form-wide">
                <input type="hidden" name="brandId" value={b.id} />
                <label>Tagline<input name="tagline" defaultValue={b.tagline ?? ""} maxLength={120} /></label>
                <label>Short description<input name="shortDescription" defaultValue={b.short_description ?? ""} maxLength={300} /></label>
                <label>Story<textarea name="story" rows={4} defaultValue={b.story ?? ""} maxLength={6000} /></label>
                <div className="adm-row">
                  <label>Accent color<input name="accentColor" defaultValue={b.accent_color ?? "#d6ad68"} pattern="#[0-9a-fA-F]{6}" /></label>
                  <ImagePicker name="hero" label="Replace banner image" />
                  <ImagePicker name="logo" label="Replace logo" />
                </div>
                <label className="adm-check"><input type="checkbox" name="publish" defaultChecked={b.active} />Published</label>
                <p><button className="adm-btn" type="submit" aria-label={`Save ${b.name}`}>Save</button></p>
              </form>
              <details className="adm-details">
                <summary>Remove this brand</summary>
                <form action={removeBrandAction} className="adm-inline">
                  <input type="hidden" name="brandId" value={b.id} />
                  <label className="adm-check"><input type="checkbox" name="confirm" required />Yes, remove {b.name}. This cannot be undone.</label>
                  <button className="adm-btn adm-danger" type="submit" aria-label={`Remove ${b.name}`}>Remove</button>
                </form>
              </details>
              </>
            ) : <p>{b.tagline}</p>}
          </section>
        ))}
      </div>
    </>
  );
}
