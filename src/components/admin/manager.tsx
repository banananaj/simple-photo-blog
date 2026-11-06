"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TagEditor, type EditItem } from "@/components/admin/tag-editor";
import { ratingOf, tags as allTags, type Photo } from "@/lib/photos";

type Row = EditItem & { photo: Photo };

function toRow(p: Photo): Row {
  return {
    id: p.id,
    thumb: p.preview.src,
    width: p.preview.width,
    height: p.preview.height,
    place: p.place,
    season: p.season,
    tags: p.tags ?? [],
    alt: p.alt,
    rating: ratingOf(p),
    note: p.taken || undefined,
    hidden: Boolean(p.hidden),
    photo: p,
  };
}

function sameTags(a: string[], b: string[]) {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

// Every photograph in the catalogue, editable the same way as a fresh upload.
export function Manager() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/admin/api/catalog", { cache: "no-store" });
    const data = (await res.json()) as { photos: Photo[] };
    setRows(data.photos.map(toRow));
    setSelected(new Set());
  }, []);

  useEffect(() => {
    // load() only sets state after its fetch resolves; the rule cannot see that.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const dirty = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          r.place !== r.photo.place ||
          r.season !== r.photo.season ||
          r.alt !== r.photo.alt ||
          r.rating !== ratingOf(r.photo) ||
          !sameTags(r.tags, r.photo.tags ?? []),
      ),
    [rows],
  );

  const onChange = useCallback((items: EditItem[]) => {
    setRows((prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.map((r) => [r.id, r]));
      return items.map((it) => ({ ...byId.get(it.id)!, ...it }));
    });
  }, []);

  const save = async () => {
    if (dirty.length === 0) return;
    setBusy("Saving…");
    const res = await fetch("/admin/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        update: dirty.map((r) => ({ id: r.id, place: r.place, season: r.season, tags: r.tags, alt: r.alt, rating: r.rating })),
      }),
    });
    const data = await res.json();
    setMessage(res.ok ? `Saved ${data.updated} change${data.updated === 1 ? "" : "s"}.` : `Save failed (${res.status}).`);
    setBusy("");
    await load();
  };

  const setHidden = async (hidden: boolean, ids: string[] = [...selected]) => {
    if (ids.length === 0) return;
    setBusy(hidden ? "Hiding…" : "Showing…");
    const res = await fetch("/admin/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ update: ids.map((id) => ({ id, hidden })) }),
    });
    const data = await res.json();
    setMessage(res.ok ? `${hidden ? "Hid" : "Showed"} ${data.updated}.` : `Update failed (${res.status}).`);
    setBusy("");
    await load();
  };

  const remove = async (ids: string[] = [...selected]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} photograph${ids.length === 1 ? "" : "s"} and their files? This cannot be undone.`)) return;
    setBusy("Deleting…");
    const res = await fetch("/admin/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove: ids }),
    });
    const data = await res.json();
    setMessage(res.ok ? `Deleted ${data.removed}.` : `Delete failed (${res.status}).`);
    setBusy("");
    await load();
  };

  if (!rows) return <p>Loading…</p>;

  const q = query.trim().toLowerCase();
  const shown = q
    ? rows.filter(
        (r) =>
          r.place.toLowerCase().includes(q) ||
          r.tags.some((t) => t.includes(q)) ||
          r.season.includes(q) ||
          r.id.includes(q) ||
          (q === "hidden" && r.hidden),
      )
    : rows;

  return (
    <section className="admin-section">
      <div className="admin-actions admin-actions-top">
        <p>
          {rows.length} photograph{rows.length === 1 ? "" : "s"}
          {rows.some((r) => r.hidden) ? `, ${rows.filter((r) => r.hidden).length} hidden` : ""}
          {dirty.length > 0 ? `, ${dirty.length} unsaved` : ""}
          {busy ? ` · ${busy}` : ""}
        </p>
        <label className="admin-search">
          Find
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="place, tag, season" />
        </label>
        <button type="button" className="admin-primary" onClick={save} disabled={dirty.length === 0 || Boolean(busy)}>
          Save changes ({dirty.length})
        </button>
        <button type="button" onClick={load} disabled={Boolean(busy)}>
          Reload
        </button>
      </div>
      {message && (
        <p role="status" className="admin-status">
          {message}
        </p>
      )}
      <TagEditor
        items={shown}
        onChange={onChange}
        selected={selected}
        onSelect={setSelected}
        knownTags={allTags(rows.map((r) => r.photo))}
        onToggleHidden={(id, hidden) => setHidden(hidden, [id])}
        actions={[
          { label: "Hide", onClick: (ids) => setHidden(true, ids) },
          { label: "Show", onClick: (ids) => setHidden(false, ids) },
          { label: "Delete", onClick: (ids) => remove(ids), danger: true },
        ]}
      />
    </section>
  );
}
