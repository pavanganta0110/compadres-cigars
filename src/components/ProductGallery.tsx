"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";

export type GalleryImage = { path: string; alt: string };

/** Product photos: clickable thumbnails, previous/next arrows, arrow keys, swipe, and click-to-enlarge. */
export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const n = images.length;
  // Functional updates so rapid clicks never act on a stale index. Wraps around at both ends.
  const step = (d: number) => setI((c) => (((c + d) % n) + n) % n);
  const current = images[i];

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (n === 0) return <div className="gallery"><div className="gallery-main gallery-empty" role="img" aria-label="No photo available yet" /></div>;

  const onKey = (e: KeyboardEvent) => {
    if (n < 2) return;
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current === null || n < 2) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  };

  return (
    <div className="gallery" onKeyDown={onKey}>
      <div className="gallery-main" onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }} onTouchEnd={onTouchEnd}>
        {/* All photos are stacked and cross-faded, so switching is instant (no waiting for the next picture to download). */}
        {images.map((img, idx) => (
          <Image key={img.path} src={img.path} alt={idx === i ? img.alt : ""} aria-hidden={idx === i ? undefined : true} className={idx === i ? "gallery-on" : "gallery-off"} fill priority={idx === 0} sizes="(max-width:900px) 100vw, 620px" />
        ))}
        <button type="button" className="gallery-zoom" onClick={() => setOpen(true)} aria-label={`Enlarge photo ${i + 1} of ${n}`}>
          <span aria-hidden="true">⤢</span>
        </button>
        {n > 1 && (
          <>
            <button type="button" className="gallery-nav gallery-prev" onClick={() => step(-1)} aria-label="Previous photo"><span aria-hidden="true">‹</span></button>
            <button type="button" className="gallery-nav gallery-next" onClick={() => step(1)} aria-label="Next photo"><span aria-hidden="true">›</span></button>
            <p className="gallery-count" aria-live="polite">Photo {i + 1} of {n}</p>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="thumbs" role="group" aria-label="Product photos">
          {images.map((img, idx) => (
            <button key={img.path} type="button" className={`thumb ${idx === i ? "thumb-active" : ""}`} onClick={() => setI(idx)} aria-label={`Show photo ${idx + 1} of ${n}`} aria-current={idx === i ? "true" : undefined}>
              <Image src={img.path} alt="" fill sizes="160px" />
            </button>
          ))}
        </div>
      )}

      <dialog ref={dialog} className="lightbox" onClose={() => setOpen(false)} onKeyDown={onKey} aria-label="Enlarged product photo" onClick={(e) => { if (e.target === dialog.current) setOpen(false); }}>
        <div className="lightbox-body">
          <div className="lightbox-img">{open && <Image src={current.path} alt={current.alt} fill sizes="100vw" />}</div>
          {n > 1 && <button type="button" className="gallery-nav gallery-prev" onClick={() => step(-1)} aria-label="Previous photo"><span aria-hidden="true">‹</span></button>}
          {n > 1 && <button type="button" className="gallery-nav gallery-next" onClick={() => step(1)} aria-label="Next photo"><span aria-hidden="true">›</span></button>}
          <button type="button" className="lightbox-close" onClick={() => setOpen(false)} aria-label="Close enlarged photo"><span aria-hidden="true">×</span></button>
        </div>
      </dialog>
    </div>
  );
}
