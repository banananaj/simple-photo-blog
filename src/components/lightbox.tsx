"use client";

import { useEffect, useRef } from "react";
import type { Photo } from "@/lib/photos";

type Props = {
  photos: Photo[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
};

const SWIPE = 48;

export function Lightbox({ photos, index, onChange, onClose }: Props) {
  const photo = photos[index];
  const count = photos.length;
  const prev = () => onChange((index - 1 + count) % count);
  const next = () => onChange((index + 1) % count);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

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
        <figcaption>{photo.place}</figcaption>
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
        <a href={photo.full.src} download={`gidong-${photo.id}.jpg`}>
          Download
        </a>
      </div>
    </div>
  );
}
