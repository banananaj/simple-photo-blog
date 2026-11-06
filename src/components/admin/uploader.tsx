"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { TagEditor, type EditItem } from "@/components/admin/tag-editor";
import { prepare, seasonOf, type Prepared } from "@/lib/image-client";
import type { Photo } from "@/lib/photos";

type Stage = "pick" | "preparing" | "confirm" | "uploading" | "done";

type Draft = EditItem & { prepared: Prepared; taken: string };

export function Uploader() {
  const [stage, setStage] = useState<Stage>("pick");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ added: number; total: number } | null>(null);
  const [knownTags, setKnownTags] = useState<string[]>([]);

  const onFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = [...list].filter((f) => f.type.startsWith("image/")).sort((a, b) => a.name.localeCompare(b.name));
    setStage("preparing");
    setErrors([]);
    // Known tags for completions, fetched while the files are being prepared.
    fetch("/admin/api/catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { photos: Photo[] }) => setKnownTags([...new Set(d.photos.flatMap((p) => p.tags ?? []))].sort()))
      .catch(() => {});
    setProgress({ done: 0, total: files.length, current: "" });
    const out: Draft[] = [];
    const errs: string[] = [];
    for (const [i, file] of files.entries()) {
      setProgress({ done: i, total: files.length, current: file.name });
      try {
        const p = await prepare(file);
        if (out.some((d) => d.id === p.id)) continue;
        const taken = p.taken ? new Date(p.taken) : null;
        out.push({
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
        });
      } catch (e) {
        errs.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setDrafts(out);
    setErrors(errs);
    setSelected(new Set());
    setStage(out.length ? "confirm" : "pick");
  };

  const onChange = useCallback((items: EditItem[]) => {
    setDrafts((prev) => {
      const byId = new Map(prev.map((d) => [d.id, d]));
      return items.map((it) => ({ ...byId.get(it.id)!, ...it }));
    });
  }, []);

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
    setDrafts([]);
    setSelected(new Set());
    setResult(null);
    setErrors([]);
    setStage("pick");
  };

  if (stage === "pick") {
    return (
      <section className="admin-section">
        <p>
          Pick a folder (or files). Each photograph is converted in this browser to a WebP preview and a 3000px JPEG,
          then you tag the batch before anything is uploaded.
        </p>
        <div className="uploader-pick">
          <label className="uploader-drop">
            Choose a folder
            <input
              type="file"
              accept="image/*"
              multiple
              // @ts-expect-error non-standard, widely supported
              webkitdirectory=""
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
          <label className="uploader-drop">
            Choose files
            <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} />
          </label>
        </div>
        {errors.length > 0 && (
          <ul className="admin-errors">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (stage === "preparing" || stage === "uploading") {
    return (
      <section className="admin-section" aria-live="polite">
        <p>
          {stage === "preparing" ? "Preparing" : "Uploading"} {progress.done + 1} of {progress.total}
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
        {errors.length > 0 && (
          <ul className="admin-errors">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
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
      <div className="admin-actions admin-actions-top">
        <p>
          {drafts.length} photograph{drafts.length === 1 ? "" : "s"} ready. Tag them, then save.
        </p>
        <button type="button" className="admin-primary" onClick={save}>
          Upload and save
        </button>
        <button type="button" onClick={reset}>
          Discard
        </button>
      </div>
      {errors.length > 0 && (
        <ul className="admin-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
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
          { label: "Drop from batch", onClick: (ids) => { setDrafts((prev) => prev.filter((d) => !ids.includes(d.id))); setSelected(new Set()); }, danger: true },
        ]}
      />
    </section>
  );
}
