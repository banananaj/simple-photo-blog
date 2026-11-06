"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { TagEditor, type EditItem } from "@/components/admin/tag-editor";
import { prepare, seasonOf, type Prepared } from "@/lib/image-client";
import type { Photo } from "@/lib/photos";

type Stage = "edit" | "uploading" | "done";

type Draft = EditItem & { prepared: Prepared; taken: string };

/**
 * Pick a folder or files as often as you like: each pick is converted in the
 * browser and appended to one list. Nothing leaves the browser until the one
 * "Upload" button at the end.
 */
export function Uploader() {
  const [stage, setStage] = useState<Stage>("edit");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preparing, setPreparing] = useState<{ done: number; total: number; current: string } | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ added: number; total: number } | null>(null);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  // Ids already in the list, kept in step synchronously so a duplicate in the same pick is caught.
  const ids = useRef<Set<string>>(new Set());

  const onFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = [...list].filter((f) => f.type.startsWith("image/")).sort((a, b) => a.name.localeCompare(b.name));
    if (files.length === 0) return;
    if (knownTags.length === 0) {
      fetch("/admin/api/catalog", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { photos: Photo[] }) => setKnownTags([...new Set(d.photos.flatMap((p) => p.tags ?? []))].sort()))
        .catch(() => {});
    }
    setPreparing({ done: 0, total: files.length, current: "" });
    const errs: string[] = [];
    let skipped = 0;
    for (const [i, file] of files.entries()) {
      setPreparing({ done: i, total: files.length, current: file.name });
      try {
        const p = await prepare(file);
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
              note: `${file.name}${p.taken ? ` · ${p.taken}` : ""}`,
              prepared: p,
              taken: p.taken,
            },
          ];
        });
      } catch (e) {
        errs.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    if (skipped) errs.push(`${skipped} already in the list, skipped`);
    setErrors(errs);
    setPreparing(null);
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
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <label className="uploader-drop">
        {drafts.length ? "Add files" : "Choose files"}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={Boolean(preparing)}
          onChange={(e) => {
            onFiles(e.target.files);
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
    <section className="admin-section">
      {drafts.length === 0 && !preparing && (
        <p>
          Pick a folder or files, as many times as you like. Each photograph is converted in this browser to a WebP
          preview and a 3000px JPEG and added to the list below. Nothing is uploaded until you press Upload.
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
