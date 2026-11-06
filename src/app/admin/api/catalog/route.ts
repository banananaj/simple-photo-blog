import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { cleanRating, deleteFiles, loadCatalog, saveCatalog } from "@/lib/catalog";
import { parseTags, SEASONS, type Photo } from "@/lib/photos";

type Patch = Partial<Pick<Photo, "place" | "season" | "tags" | "alt" | "taken" | "hidden" | "rating">> & { id: string };
type Body = { add?: Photo[]; update?: Patch[]; remove?: string[] };

const ID = /^[a-z0-9-]{4,64}$/i;

function cleanSeason(s: unknown): Photo["season"] {
  return typeof s === "string" && (SEASONS as string[]).includes(s) ? (s as Photo["season"]) : "";
}

function cleanTags(t: unknown): string[] {
  if (Array.isArray(t)) return parseTags(t.map(String).join(","));
  if (typeof t === "string") return parseTags(t);
  return [];
}

function cleanPhoto(p: Photo): Photo | null {
  if (!ID.test(p.id) || !p.preview?.src || !p.full?.src) return null;
  const okSrc = (s: string) => s.includes(".blob.vercel-storage.com") || s.startsWith("/photos/");
  if (!okSrc(p.preview.src) || !okSrc(p.full.src)) return null;
  return {
    id: p.id,
    preview: { src: p.preview.src, width: Number(p.preview.width) || 0, height: Number(p.preview.height) || 0 },
    full: { src: p.full.src, width: Number(p.full.width) || 0, height: Number(p.full.height) || 0 },
    place: String(p.place ?? "").trim(),
    season: cleanSeason(p.season),
    taken: String(p.taken ?? ""),
    alt: String(p.alt ?? "").trim() || String(p.place ?? "").trim(),
    credit: String(p.credit ?? ""),
    tags: cleanTags(p.tags),
    rating: cleanRating(p.rating),
    hidden: Boolean(p.hidden),
    uploadedAt: p.uploadedAt ?? new Date().toISOString(),
  };
}

export async function GET() {
  const photos = await loadCatalog();
  return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const photos = await loadCatalog();
  const byId = new Map(photos.map((p) => [p.id, p]));
  let added = 0;
  let updated = 0;
  let removed = 0;

  for (const raw of body.add ?? []) {
    const p = cleanPhoto(raw);
    if (!p) continue;
    byId.set(p.id, { ...(byId.get(p.id) ?? {}), ...p });
    added++;
  }
  for (const patch of body.update ?? []) {
    const cur = byId.get(patch.id);
    if (!cur) continue;
    byId.set(patch.id, {
      ...cur,
      place: patch.place !== undefined ? String(patch.place).trim() : cur.place,
      season: patch.season !== undefined ? cleanSeason(patch.season) : cur.season,
      tags: patch.tags !== undefined ? cleanTags(patch.tags) : cur.tags,
      alt: patch.alt !== undefined ? String(patch.alt).trim() : cur.alt,
      taken: patch.taken !== undefined ? String(patch.taken) : cur.taken,
      hidden: patch.hidden !== undefined ? Boolean(patch.hidden) : cur.hidden,
      rating: patch.rating !== undefined ? cleanRating(patch.rating) : cur.rating,
    });
    updated++;
  }
  for (const id of body.remove ?? []) {
    const cur = byId.get(id);
    if (!cur) continue;
    try {
      await deleteFiles(cur);
    } catch {
      // the file may already be gone; the catalogue entry still goes
    }
    byId.delete(id);
    removed++;
  }

  const next = [...byId.values()];
  await saveCatalog(next);
  revalidateTag("catalog", { expire: 0 });
  return NextResponse.json({ added, updated, removed, total: next.length });
}
