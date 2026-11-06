"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Lightbox } from "@/components/lightbox";
import { apply, shuffle, type Photo } from "@/lib/photos";

type Props = { photos: Photo[] };

// One seed per page load, drawn in the browser only. The server (and the first
// hydration pass) sees null and renders the stored order; the browser then
// re-renders with its own order. No hydration mismatch, no setState in an effect.
const clientSeed = typeof window === "undefined" ? null : Math.random();
const noop = () => () => {};
const useSeed = () => useSyncExternalStore(noop, () => clientSeed, () => null);

// Column count follows the same breakpoints as the stylesheet (80rem, 40rem).
const QUERIES = ["(min-width: 80rem)", "(min-width: 40rem)"];
function subscribeColumns(cb: () => void) {
  const lists = QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", cb));
  return () => lists.forEach((l) => l.removeEventListener("change", cb));
}
function readColumns() {
  if (window.matchMedia(QUERIES[0]).matches) return 3;
  if (window.matchMedia(QUERIES[1]).matches) return 2;
  return 1;
}
const useColumns = () => useSyncExternalStore(subscribeColumns, readColumns, () => 3);

function mulberry32(seed: number) {
  let a = Math.floor(seed * 2 ** 32) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deal photographs to the shortest column so the columns end close together.
function distribute(list: Photo[], columns: number): { photo: Photo; index: number }[][] {
  const cols = Array.from({ length: columns }, () => [] as { photo: Photo; index: number }[]);
  const heights = new Array(columns).fill(0);
  list.forEach((photo, index) => {
    let c = 0;
    for (let i = 1; i < columns; i++) if (heights[i] < heights[c]) c = i;
    cols[c].push({ photo, index });
    heights[c] += photo.preview.height / photo.preview.width;
  });
  return cols;
}

export function Stream({ photos }: Props) {
  const params = useSearchParams();
  const season = params.get("season") ?? "";
  const place = params.get("place") ?? "";
  const tag = params.get("tag") ?? "";
  const seed = useSeed();
  const columns = useColumns();

  const list = useMemo(() => {
    const filtered = apply(photos, { season, place, tag });
    return seed === null ? filtered : shuffle(filtered, mulberry32(seed));
  }, [photos, season, place, tag, seed]);
  const dealt = useMemo(() => distribute(list, columns), [list, columns]);

  const [open, setOpen] = useState<number | null>(null);

  if (list.length === 0) {
    return (
      <p className="stream-empty" role="status">
        No photographs match this filter.
      </p>
    );
  }

  return (
    <>
      <div className="stream" data-ready={seed === null ? undefined : ""}>
        {dealt.map((col, c) => (
          <ul key={c} className="stream-col">
            {col.map(({ photo, index }) => (
              <li key={photo.id}>
                <figure>
                  <button
                    type="button"
                    className="stream-open"
                    onClick={() => setOpen(index)}
                    aria-label={`Open ${photo.place || "photograph"} at full size`}
                  >
                    <img
                      src={photo.preview.src}
                      width={photo.preview.width}
                      height={photo.preview.height}
                      alt={photo.alt}
                      loading={index < 3 ? "eager" : "lazy"}
                      decoding="async"
                      fetchPriority={index === 0 ? "high" : undefined}
                    />
                  </button>
                  <figcaption>{photo.place}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        ))}
      </div>
      {open !== null && <Lightbox photos={list} index={open} onChange={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}
