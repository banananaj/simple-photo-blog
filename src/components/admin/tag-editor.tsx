"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TagInput } from "@/components/admin/tag-input";
import { RATINGS, SEASONS } from "@/lib/photos";

export type EditItem = {
  id: string;
  thumb: string;
  width: number;
  height: number;
  place: string;
  season: string;
  tags: string[];
  alt: string;
  rating: number;
  note?: string;
  hidden?: boolean;
};

export type SelectionAction = {
  label: string;
  onClick: (ids: string[]) => void;
  danger?: boolean;
};

type Props = {
  items: EditItem[];
  onChange: (items: EditItem[]) => void;
  selected: Set<string>;
  onSelect: (ids: Set<string>) => void;
  /** Per-card eye toggle. */
  onToggleHidden?: (id: string, hidden: boolean) => void;
  /** Extra buttons in the selection bar (hide, show, delete…). */
  actions?: SelectionAction[];
  /** Known tags, offered as completions. */
  knownTags?: string[];
};

type Rect = { x: number; y: number; w: number; h: number };

function intersects(a: DOMRect, b: Rect) {
  return a.left < b.x + b.w && a.left + a.width > b.x && a.top < b.y + b.h && a.top + a.height > b.y;
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

/**
 * The grid every tagging job shares: the upload confirm screen and the photo
 * manager. Drag on the background to select a region (Shift adds, Alt removes),
 * click a photograph to toggle it (Shift/Ctrl keep the rest), then apply a
 * place, season or tags to the selection or to everything. Each card takes its
 * own values and has an eye to hide or show it on the spot. Selection-wide
 * actions live in a bar that appears only while something is selected.
 */
export function TagEditor({ items, onChange, selected, onSelect, onToggleHidden, actions = [], knownTags = [] }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    mode: "replace" | "add" | "remove";
    base: Set<string>;
    card: string | null;
    additive: boolean;
  } | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [bulk, setBulk] = useState<{ place: string; season: string; tags: string[]; rating: string }>({ place: "", season: "", tags: [], rating: "" });
  // Completions: everything known plus whatever this batch already carries.
  const suggestions = useMemo(
    () => [...new Set([...knownTags, ...items.flatMap((i) => i.tags)])].sort((a, b) => a.localeCompare(b)),
    [knownTags, items],
  );

  const update = (ids: Iterable<string>, patch: Partial<EditItem> | ((it: EditItem) => Partial<EditItem>)) => {
    const set = new Set(ids);
    onChange(items.map((it) => (set.has(it.id) ? { ...it, ...(typeof patch === "function" ? patch(it) : patch) } : it)));
  };

  const applyBulk = (ids: Iterable<string>) => {
    const add = bulk.tags;
    update(ids, (it) => ({
      place: bulk.place.trim() ? bulk.place.trim() : it.place,
      season: bulk.season ? bulk.season : it.season,
      tags: add.length ? [...new Set([...it.tags, ...add])] : it.tags,
      rating: bulk.rating ? Number(bulk.rating) : it.rating,
    }));
  };

  const removeTags = (ids: Iterable<string>) => {
    const drop = new Set(bulk.tags);
    if (drop.size === 0) return;
    update(ids, (it) => ({ tags: it.tags.filter((t) => !drop.has(t)) }));
  };

  // Pointer capture retargets later events to the grid, so the card under the
  // pointer is remembered at pointerdown and the click is resolved at pointerup.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, select, button, textarea, label, a")) return;
    const mode = e.shiftKey ? "add" : e.altKey ? "remove" : "replace";
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      mode,
      base: new Set(selected),
      card: target.closest<HTMLElement>("[data-id]")?.dataset.id ?? null,
      additive: e.shiftKey || e.ctrlKey || e.metaKey,
    };
    setMarquee({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { x, y } = drag.current;
    setMarquee({ x: Math.min(x, e.clientX), y: Math.min(y, e.clientY), w: Math.abs(e.clientX - x), h: Math.abs(e.clientY - y) });
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !marquee) return;
    setMarquee(null);
    const moved = marquee.w > 4 || marquee.h > 4;
    if (!moved) {
      // A click: toggle the card; a plain click starts a fresh selection of one.
      if (d.card) {
        const next = new Set(d.additive ? d.base : []);
        if (d.mode === "remove") next.delete(d.card);
        else if (d.base.has(d.card) && (d.additive || d.base.size === 1)) next.delete(d.card);
        else next.add(d.card);
        onSelect(next);
      } else if (d.mode === "replace") {
        onSelect(new Set());
      }
      return;
    }
    const hit = new Set<string>();
    gridRef.current?.querySelectorAll<HTMLElement>("[data-id]").forEach((el) => {
      if (intersects(el.getBoundingClientRect(), marquee)) hit.add(el.dataset.id!);
    });
    const next = d.mode === "replace" ? hit : new Set(d.base);
    if (d.mode === "add") hit.forEach((id) => next.add(id));
    if (d.mode === "remove") hit.forEach((id) => next.delete(id));
    onSelect(next);
  };

  // Escape clears the selection; Ctrl/Cmd+A selects everything.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, select, textarea")) return;
      if (e.key === "Escape") onSelect(new Set());
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        onSelect(new Set(items.map((i) => i.id)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, onSelect]);

  const n = selected.size;
  const ids = [...selected];

  return (
    <div className="tagedit">
      <div className="tagedit-toolbar">
        <label>
          Place
          <input type="text" value={bulk.place} onChange={(e) => setBulk({ ...bulk, place: e.target.value })} placeholder="leave empty to keep" />
        </label>
        <label>
          Season
          <select value={bulk.season} onChange={(e) => setBulk({ ...bulk, season: e.target.value })}>
            <option value="">keep</option>
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rating
          <select value={bulk.rating} onChange={(e) => setBulk({ ...bulk, rating: e.target.value })}>
            <option value="">keep</option>
            {RATINGS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {/* htmlFor keeps the label bound to the text input, not to the first chip's remove button. */}
        <div className="tagedit-grow tagedit-field">
          <label htmlFor="bulk-tags">Tags</label>
          <TagInput id="bulk-tags" value={bulk.tags} onChange={(tags) => setBulk({ ...bulk, tags })} suggestions={suggestions} placeholder="type a tag, press Space" />
        </div>
        <div className="tagedit-actions">
          <button type="button" onClick={() => applyBulk(items.map((i) => i.id))}>
            Apply to all
          </button>
          <button type="button" onClick={() => removeTags(items.map((i) => i.id))} disabled={bulk.tags.length === 0}>
            Remove tags from all
          </button>
        </div>
        <p className="tagedit-hint">Click a photograph to select it, drag on the background for a region. Shift adds, Alt removes, Esc clears, Ctrl+A selects all.</p>
      </div>

      <div
        ref={gridRef}
        className="tagedit-grid"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setMarquee(null);
        }}
      >
        {items.map((it, i) => (
          <div
            key={it.id}
            className="tagedit-card"
            data-id={it.id}
            data-selected={selected.has(it.id) ? "" : undefined}
            data-hidden={it.hidden ? "" : undefined}
          >
            <div className="tagedit-pic">
              <img src={it.thumb} alt={it.alt} width={it.width} height={it.height} loading={i < 8 ? "eager" : "lazy"} draggable={false} />
              {onToggleHidden && (
                <button
                  type="button"
                  className="tagedit-eye"
                  onClick={() => onToggleHidden(it.id, !it.hidden)}
                  aria-pressed={Boolean(it.hidden)}
                  aria-label={it.hidden ? "Hidden from visitors. Show it" : "Shown to visitors. Hide it"}
                  title={it.hidden ? "Show" : "Hide"}
                >
                  <EyeIcon off={Boolean(it.hidden)} />
                </button>
              )}
            </div>
            {it.hidden && <p className="tagedit-hidden">Hidden from visitors</p>}
            {it.note && <p className="tagedit-note">{it.note}</p>}
            <label>
              Place
              <input type="text" value={it.place} onChange={(e) => update([it.id], { place: e.target.value })} />
            </label>
            <label>
              Season
              <select value={it.season} onChange={(e) => update([it.id], { season: e.target.value })}>
                <option value="">none</option>
                {SEASONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="tagedit-field">
              <label htmlFor={`tags-${it.id}`}>Tags</label>
              <TagInput id={`tags-${it.id}`} compact value={it.tags} onChange={(tags) => update([it.id], { tags })} suggestions={suggestions} />
            </div>
            <label>
              Rating
              <select value={it.rating} onChange={(e) => update([it.id], { rating: Number(e.target.value) })}>
                {RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Alt text
              <input type="text" value={it.alt} onChange={(e) => update([it.id], { alt: e.target.value })} />
            </label>
          </div>
        ))}
      </div>

      {n > 0 && (
        <div className="tagedit-bar" role="region" aria-label="Selected photographs">
          <p>{n} selected</p>
          <button type="button" onClick={() => applyBulk(ids)}>
            Apply fields
          </button>
          <button type="button" onClick={() => removeTags(ids)} disabled={bulk.tags.length === 0}>
            Remove tags
          </button>
          {actions.map((a) => (
            <button key={a.label} type="button" className={a.danger ? "tagedit-danger" : undefined} onClick={() => a.onClick(ids)}>
              {a.label}
            </button>
          ))}
          <button type="button" onClick={() => onSelect(new Set())}>
            Clear
          </button>
        </div>
      )}

      {marquee && (
        <div
          className="tagedit-marquee"
          aria-hidden="true"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}
    </div>
  );
}
