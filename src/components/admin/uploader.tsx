"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { TagEditor, type EditItem } from "@/components/admin/tag-editor";
import { collectDropped, dragHasFiles, locateInput, type Located } from "@/lib/dropped";
import { prepare, readMeta, seasonOf, type Meta, type Prepared } from "@/lib/image-client";
import { RATINGS, type Photo } from "@/lib/photos";

type Stage = "edit" | "uploading" | "done";

type Draft = EditItem & { prepared: Prepared; taken: string };

/** A folder (picked or dropped) stages only the files rated at or above the threshold; loose files stage as they are. */
type Pick = { files: File[]; ratedOnly: boolean };

/** A folder pick waiting for the owner to choose which of its folders to take. */
type Chooser = { groups: { dir: string; files: File[] }[]; checked: Set<string> };

const isImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|tiff?|heic|avif)$/i.test(f.name);

// The rating threshold for folders, remembered in this browser. Read through
// useSyncExternalStore so the server render (1) and the first client render agree.
const MIN_KEY = "uploader.minRating";
const minListeners = new Set<() => void>();
function readMin(): number {
  const n = Number(localStorage.getItem(MIN_KEY));
  return n >= 1 && n <= 5 ? n : 1;
}
function writeMin(n: number) {
  localStorage.setItem(MIN_KEY, String(n));
  minListeners.forEach((l) => l());
}
function subscribeMin(l: () => void) {
  minListeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    minListeners.delete(l);
    window.removeEventListener("storage", l);
  };
}
const useMinRating = () => useSyncExternalStore(subscribeMin, readMin, () => 1);

/** Group located files by folder, folders in path order; files without a folder go under "". */
function groupByDir(located: Located[]): { dir: string; files: File[] }[] {
  const map = new Map<string, File[]>();
  for (const { file, dir } of located) {
    if (!isImage(file)) continue;
    map.set(dir, [...(map.get(dir) ?? []), file]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([dir, files]) => ({ dir, files }));
}

/**
 * Pick a folder or files, or drop them on the page, as often as you like: each
 * pick is converted in the browser and appended to one list. Nothing leaves the
 * browser until the one "Upload" button at the end.
 */
export function Uploader() {
  const [stage, setStage] = useState<Stage>("edit");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preparing, setPreparing] = useState<{ done: number; total: number; current: string } | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [result, setResult] = useState<{ added: number; total: number } | null>(null);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const minRating = useMinRating();
  // Ids already in the list, kept in step synchronously so a duplicate in the same pick is caught.
  const ids = useRef<Set<string>>(new Set());
  const dragDepth = useRef(0);

  const addPicks = async (picks: Pick[]) => {
    const all = picks.flatMap((p) => p.files.filter(isImage));
    if (all.length === 0) return;
    if (knownTags.length === 0) {
      fetch("/admin/api/catalog", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { photos: Photo[] }) => setKnownTags([...new Set(d.photos.flatMap((p) => p.tags ?? []))].sort()))
        .catch(() => {});
    }
    const errs: string[] = [];
    const info: string[] = [];
    let skipped = 0;
    let unrated = 0;
    let below = 0;

    // Read metadata first, so a folder's unrated files are dropped before the expensive conversion.
    setPreparing({ done: 0, total: all.length, current: "" });
    const queue: { file: File; meta: Meta }[] = [];
    let n = 0;
    for (const pick of picks) {
      const files = pick.files.filter(isImage).sort((a, b) => a.name.localeCompare(b.name));
      for (const file of files) {
        setPreparing({ done: n++, total: all.length, current: `reading ${file.name}` });
        const meta = await readMeta(file);
        if (pick.ratedOnly && meta.rating === null) {
          unrated++;
          continue;
        }
        if (pick.ratedOnly && meta.rating !== null && meta.rating < minRating) {
          below++;
          continue;
        }
        queue.push({ file, meta });
      }
    }

    setPreparing({ done: 0, total: queue.length, current: "" });
    for (const [i, { file, meta }] of queue.entries()) {
      setPreparing({ done: i, total: queue.length, current: file.name });
      try {
        const p = await prepare(file, meta);
        if (ids.current.has(p.id)) {
          skipped++;
          URL.revokeObjectURL(p.preview.url);
          continue;
        }
        ids.current.add(p.id);
        setDrafts((prev) => {
          const taken = p.taken ? new Date(p.taken) : null;
          return [
            ...prev,
            {
              id: p.id,
              thumb: p.preview.url,
              width: p.preview.width,
              height: p.preview.height,
              place: "",
              season: seasonOf(taken),
              tags: [],
              alt: "",
              rating: p.rating,
              note: `${file.name}${p.taken ? ` · ${p.taken}` : ""}${p.rated ? "" : " · no rating in file"}`,
              prepared: p,
              taken: p.taken,
            },
          ];
        });
      } catch (e) {
        errs.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    if (unrated) info.push(`${unrated} file${unrated === 1 ? "" : "s"} in the folder without a star rating, left out`);
    if (below) info.push(`${below} file${below === 1 ? "" : "s"} rated below ${minRating}, left out`);
    if (skipped) info.push(`${skipped} already in the list, skipped`);
    if (queue.length === 0 && (unrated || below)) info.push("Nothing to stage from the folder at this rating");
    setErrors(errs);
    setNotes(info);
    setPreparing(null);
  };

  const onInput = (list: FileList | null, ratedOnly: boolean) => {
    if (list && list.length) addPicks([{ files: [...list], ratedOnly }]);
  };

  // A folder pick with several folders inside shows a chooser first; one folder stages at once.
  const stageFolders = (located: Located[], loose: File[] = []) => {
    const groups = groupByDir(located);
    if (groups.length > 1) {
      setChooser({ groups, checked: new Set(groups.map((g) => g.dir)) });
      if (loose.length) addPicks([{ files: loose, ratedOnly: false }]);
      return;
    }
    addPicks([
      { files: groups.flatMap((g) => g.files), ratedOnly: true },
      { files: loose, ratedOnly: false },
    ]);
  };

  const confirmChooser = () => {
    if (!chooser) return;
    const files = chooser.groups.filter((g) => chooser.checked.has(g.dir)).flatMap((g) => g.files);
    setChooser(null);
    addPicks([{ files, ratedOnly: true }]);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setOver(false);
    if (preparing || !dragHasFiles(e.dataTransfer)) return;
    const { loose, fromFolders } = await collectDropped(e.dataTransfer);
    stageFolders(fromFolders, loose);
  };
  const onDragEnter = (e: React.DragEvent) => {
    if (!dragHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepth.current++;
    setOver(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setOver(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!dragHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = preparing ? "none" : "copy";
  };

  const onChange = useCallback((items: EditItem[]) => {
    setDrafts((prev) => {
      const byId = new Map(prev.map((d) => [d.id, d]));
      return items.map((it) => ({ ...byId.get(it.id)!, ...it }));
    });
  }, []);

  const dropFromList = (dropIds: string[]) => {
    setDrafts((prev) => {
      prev.filter((d) => dropIds.includes(d.id)).forEach((d) => URL.revokeObjectURL(d.thumb));
      return prev.filter((d) => !dropIds.includes(d.id));
    });
    dropIds.forEach((id) => ids.current.delete(id));
    setSelected(new Set());
  };

  const save = async () => {
    setStage("uploading");
    setProgress({ done: 0, total: drafts.length, current: "" });
    const added: Photo[] = [];
    const errs: string[] = [];
    for (const [i, d] of drafts.entries()) {
      setProgress({ done: i, total: drafts.length, current: d.prepared.name });
      try {
        const [preview, full] = await Promise.all([
          upload(`${d.id}/preview.webp`, d.prepared.preview.blob, {
            access: "public",
            handleUploadUrl: "/admin/api/blob",
            contentType: "image/webp",
          }),
          upload(`${d.id}/full.jpg`, d.prepared.full.blob, {
            access: "public",
            handleUploadUrl: "/admin/api/blob",
            contentType: "image/jpeg",
            multipart: true,
          }),
        ]);
        added.push({
          id: d.id,
          preview: { src: preview.url, width: d.prepared.preview.width, height: d.prepared.preview.height },
          full: { src: full.url, width: d.prepared.full.width, height: d.prepared.full.height },
          place: d.place,
          season: d.season as Photo["season"],
          taken: d.taken,
          alt: d.alt || d.place,
          credit: "",
          tags: d.tags,
          rating: d.rating,
          hidden: Boolean(d.hidden),
          uploadedAt: new Date().toISOString(),
        });
      } catch (e) {
        errs.push(`${d.prepared.name}: ${(e as Error).message}`);
      }
    }
    setProgress({ done: drafts.length, total: drafts.length, current: "" });
    if (added.length) {
      const res = await fetch("/admin/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add: added }),
      });
      if (res.ok) setResult(await res.json());
      else errs.push(`catalogue save failed (${res.status})`);
    }
    setErrors(errs);
    setStage("done");
  };

  const reset = () => {
    drafts.forEach((d) => URL.revokeObjectURL(d.thumb));
    ids.current.clear();
    setDrafts([]);
    setSelected(new Set());
    setResult(null);
    setErrors([]);
    setNotes([]);
    setStage("edit");
  };

  const pickers = (
    <div className="uploader-pick">
      <label className="uploader-drop">
        {drafts.length ? "Add a folder" : "Choose a folder"}
        <input
          type="file"
          accept="image/*"
          multiple
          // @ts-expect-error non-standard, widely supported
          webkitdirectory=""
          disabled={Boolean(preparing)}
          onChange={(e) => {
            if (e.target.files?.length) stageFolders(locateInput(e.target.files));
            e.target.value = "";
          }}
        />
      </label>
      <label className="uploader-min">
        From folders, rated
        <select value={minRating} onChange={(e) => writeMin(Number(e.target.value))} disabled={Boolean(preparing)}>
          {[...RATINGS].reverse().map((r) => (
            <option key={r} value={r}>
              {r === 1 ? "1 and up (any rating)" : `${r} and up`}
            </option>
          ))}
        </select>
      </label>
      <label className="uploader-drop">
        {drafts.length ? "Add files" : "Choose files"}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={Boolean(preparing)}
          onChange={(e) => {
            onInput(e.target.files, false);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );

  const errorList = errors.length > 0 && (
    <ul className="admin-errors">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );

  const noteList = notes.length > 0 && (
    <ul className="uploader-hint" aria-live="polite">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );

  if (stage === "uploading") {
    return (
      <section className="admin-section" aria-live="polite">
        <p>
          Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}
          {progress.current ? `: ${progress.current}` : ""}
        </p>
        <progress value={progress.done} max={progress.total} />
      </section>
    );
  }

  if (stage === "done") {
    return (
      <section className="admin-section" aria-live="polite">
        {result && (
          <p>
            Added {result.added} photograph{result.added === 1 ? "" : "s"}. The catalogue now holds {result.total}.
          </p>
        )}
        {errorList}
        <div className="admin-actions">
          <button type="button" onClick={reset}>
            Upload more
          </button>
          <Link href="/admin/photos">Open Photos</Link>
          <Link href="/">View site</Link>
        </div>
      </section>
    );
  }

  return (
    <section
      className="admin-section uploader-zone"
      data-over={over ? "" : undefined}
      onDrop={onDrop}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
    >
      {drafts.length === 0 && !preparing && (
        <p>
          Pick a folder or files, or drag them anywhere onto this page, as many times as you like. From a folder only
          the photographs rated at or above the chosen stars are taken (XnView MP, Lightroom and Bridge write the
          rating into the file); a pick with several folders inside asks which to take first. Files picked one by one
          are taken as they are. Each photograph is converted in this browser to a WebP preview and a
          3000px JPEG and added to the list below. Nothing is uploaded until you press Upload.
        </p>
      )}
      <div className="admin-actions admin-actions-top">
        {pickers}
        {preparing && (
          <p aria-live="polite">
            Preparing {Math.min(preparing.done + 1, preparing.total)} of {preparing.total}
            {preparing.current ? `: ${preparing.current}` : ""}
          </p>
        )}
        {!preparing && drafts.length > 0 && (
          <p>
            {drafts.length} photograph{drafts.length === 1 ? "" : "s"} in the list
          </p>
        )}
        {drafts.length > 0 && (
          <>
            <button type="button" className="admin-primary" onClick={save} disabled={Boolean(preparing)}>
              Upload {drafts.length}
            </button>
            <button type="button" onClick={reset} disabled={Boolean(preparing)}>
              Clear list
            </button>
          </>
        )}
      </div>
      {preparing && <progress value={preparing.done} max={preparing.total} />}
      {chooser && (
        <div className="uploader-folders" role="group" aria-label="Folders in this pick">
          <p>
            {chooser.groups.length} folders in this pick. Take which ones? (only files rated {minRating} and up are
            staged)
          </p>
          <ul>
            {chooser.groups.map((g) => (
              <li key={g.dir}>
                <label>
                  <input
                    type="checkbox"
                    checked={chooser.checked.has(g.dir)}
                    onChange={(e) => {
                      const checked = new Set(chooser.checked);
                      if (e.target.checked) checked.add(g.dir);
                      else checked.delete(g.dir);
                      setChooser({ ...chooser, checked });
                    }}
                  />
                  {g.dir || "(top level)"} <span className="num">{g.files.length}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="admin-actions">
            <button type="button" className="admin-primary" onClick={confirmChooser} disabled={chooser.checked.size === 0}>
              Stage {chooser.checked.size} folder{chooser.checked.size === 1 ? "" : "s"}
            </button>
            <button type="button" onClick={() => setChooser({ ...chooser, checked: new Set(chooser.groups.map((g) => g.dir)) })}>
              All
            </button>
            <button type="button" onClick={() => setChooser({ ...chooser, checked: new Set() })}>
              None
            </button>
            <button type="button" onClick={() => setChooser(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {noteList}
      {errorList}
      {drafts.length > 0 && (
        <TagEditor
          items={drafts}
          onChange={onChange}
          selected={selected}
          onSelect={setSelected}
          knownTags={knownTags}
          onToggleHidden={(id, hidden) => onChange(drafts.map((d) => (d.id === id ? { ...d, hidden } : d)))}
          actions={[
            { label: "Hide", onClick: (ids) => onChange(drafts.map((d) => (ids.includes(d.id) ? { ...d, hidden: true } : d))) },
            { label: "Show", onClick: (ids) => onChange(drafts.map((d) => (ids.includes(d.id) ? { ...d, hidden: false } : d))) },
            { label: "Remove from list", onClick: dropFromList, danger: true },
          ]}
        />
      )}
    </section>
  );
}
