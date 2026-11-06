"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Lightbox } from "@/components/lightbox";
import { shuffle, type Photo } from "@/lib/photos";

type Props = { photos: Photo[] };

// Same per-visit seed idea as the stream: the server renders the stored order,
// the browser then deals its own.
const clientSeed = typeof window === "undefined" ? null : Math.random();
const noop = () => () => {};
const useSeed = () => useSyncExternalStore(noop, () => clientSeed, () => null);

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

// How many "units" of aspect ratio one row holds (width ÷ wanted row height).
// Breakpoints only, so the server can render the same partition it will hydrate.
const STEPS: [string, number][] = [
  ["(min-width: 120rem)", 6.4],
  ["(min-width: 90rem)", 5.2],
  ["(min-width: 64rem)", 4.2],
  ["(min-width: 48rem)", 3.2],
  ["(min-width: 32rem)", 2.3],
];
const SMALL = 1.5;
function subscribeUnits(cb: () => void) {
  const lists = STEPS.map(([q]) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", cb));
  return () => lists.forEach((l) => l.removeEventListener("change", cb));
}
function readUnits() {
  for (const [q, u] of STEPS) if (window.matchMedia(q).matches) return u;
  return SMALL;
}
const useUnits = () => useSyncExternalStore(subscribeUnits, readUnits, () => 4.2);

/**
 * Justified rows: fill each row with photographs until their aspect ratios add
 * up to the row's units, then let every row stretch to the full width so the
 * wall has no seams. A thin last row borrows from the row above it.
 */
function justify(list: Photo[], units: number): Photo[][] {
  const rows: Photo[][] = [];
  let row: Photo[] = [];
  let sum = 0;
  const ratio = (p: Photo) => (p.preview.width || 3) / (p.preview.height || 2);
  for (const p of list) {
    row.push(p);
    sum += ratio(p);
    if (sum >= units) {
      rows.push(row);
      row = [];
      sum = 0;
    }
  }
  if (row.length) rows.push(row);
  // A last row far short of its units would render very tall; rebalance.
  while (rows.length > 1) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const lastSum = last.reduce((a, p) => a + ratio(p), 0);
    if (lastSum >= units * 0.6 || prev.length < 2) break;
    last.unshift(prev.pop()!);
  }
  return rows;
}

export function Wall({ photos }: Props) {
  const seed = useSeed();
  const units = useUnits();
  const list = useMemo(() => (seed === null ? photos : shuffle(photos, mulberry32(seed))), [photos, seed]);
  const rows = useMemo(() => justify(list, units), [list, units]);
  const [open, setOpen] = useState<number | null>(null);
  const indexOf = new Map(list.map((p, i) => [p.id, i]));

  if (list.length === 0) {
    return (
      <p className="wall-empty" role="status">
        No photographs yet.
      </p>
    );
  }

  return (
    <>
      <div className="wall" data-ready={seed === null ? undefined : ""}>
        {rows.map((row, r) => {
          const sum = row.reduce((a, p) => a + (p.preview.width || 3) / (p.preview.height || 2), 0);
          return (
            <div key={r} className="wall-row">
              {row.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="wall-cell"
                  style={{ width: `${(((p.preview.width || 3) / (p.preview.height || 2)) / sum) * 100}%` }}
                  onClick={() => setOpen(indexOf.get(p.id) ?? 0)}
                  aria-label={`Open ${p.place || "photograph"} at full size`}
                >
                  <img
                    src={p.preview.src}
                    width={p.preview.width}
                    height={p.preview.height}
                    alt={p.alt}
                    loading={r < 2 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {open !== null && <Lightbox photos={list} index={open} onChange={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}
