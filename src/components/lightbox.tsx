"use client";

import { useEffect, useRef } from "react";
import { downloadHref, filterHref, type Photo } from "@/lib/photos";
import { site } from "@/lib/site";

type Props = {
  photos: Photo[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
  /** Leave for another page (a place or tag filter); the owner settles history. */
  onNavigate: (href: string) => void;
};

const SWIPE = 48;

function countView(id: string) {
  try {
    const body = new Blob([JSON.stringify({ id })], { type: "application/json" });
    if (!navigator.sendBeacon("/api/view", body)) fetch("/api/view", { method: "POST", body, keepalive: true });
  } catch {
    // counting is a courtesy, never a failure
  }
}

export function Lightbox({ photos, index, onChange, onClose, onNavigate }: Props) {
  const photo = photos[index];
  const count = photos.length;
  const prev = () => onChange((index - 1 + count) % count);
  const next = () => onChange((index + 1) % count);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    countView(photo.id);
  }, [photo.id]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!touch.current) return;
    const dx = e.clientX - touch.current.x;
    const dy = e.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) (dx > 0 ? prev : next)();
  };

  // A tag or place in the letterbox opens the filtered stream.
  const go = (href: string) => onNavigate(href);

  const tags = photo.tags ?? [];

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.place ? `${photo.place}, full size` : "Photograph, full size"}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <figure className="lightbox-figure">
        <img
          key={photo.id}
          src={photo.full.src}
          width={photo.full.width}
          height={photo.full.height}
          alt={photo.alt}
          decoding="async"
        />
        <figcaption>
          {photo.place && (
            <button type="button" className="lightbox-tag" onClick={() => go(filterHref({ kind: "place", value: photo.place }))}>
              {photo.place}
            </button>
          )}
          {tags.length > 0 && (
            <ul className="lightbox-tags" aria-label="Tags">
              {tags.map((t) => (
                <li key={t}>
                  <button type="button" className="lightbox-tag" onClick={() => go(filterHref({ kind: "tag", value: t }))}>
                    {t}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </figcaption>
      </figure>
      <div className="lightbox-bar">
        <button type="button" ref={closeRef} onClick={onClose}>
          Close
        </button>
        {count > 1 && (
          <>
            <button type="button" onClick={prev} aria-label="Previous photograph">
              Previous
            </button>
            <button type="button" onClick={next} aria-label="Next photograph">
              Next
            </button>
          </>
        )}
        <a href={downloadHref(photo)} download={`${site.slug}-${photo.id}.jpg`}>
          Download
        </a>
      </div>
    </div>
  );
}
