import "server-only";
import { cacheTag } from "next/cache";
import { del, list, put } from "@vercel/blob";
import seed from "@/content/photos.json";
import { visible, type Photo } from "@/lib/photos";

/**
 * The catalogue (every photograph's metadata) lives on the Blob store as
 * `catalog/photos-<timestamp>.json`. The newest file wins; `list()` is never
 * CDN-cached, so a fresh save is visible at once. `src/content/photos.json` is
 * only the seed for a store that has no catalogue yet (and for local work
 * without a token).
 */
const PREFIX = "catalog/photos-";
const KEEP = 5;

function normalise(p: Partial<Photo> & { id: string }): Photo {
  return {
    id: p.id,
    preview: p.preview ?? { src: "", width: 0, height: 0 },
    full: p.full ?? { src: "", width: 0, height: 0 },
    place: p.place ?? "",
    season: p.season ?? "",
    taken: p.taken ?? "",
    alt: p.alt ?? p.place ?? "",
    credit: p.credit ?? "",
    tags: Array.isArray(p.tags) ? p.tags : [],
    rating: cleanRating(p.rating),
    hidden: Boolean(p.hidden),
    uploadedAt: p.uploadedAt,
  };
}

export function cleanRating(r: unknown): number {
  const n = Math.round(Number(r));
  return n >= 1 && n <= 5 ? n : 1;
}

function hasToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function newestCatalogBlob() {
  const { blobs } = await list({ prefix: PREFIX, limit: 100 });
  blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  return blobs;
}

/** Uncached read of the live catalogue (admin, writes). */
export async function loadCatalog(): Promise<Photo[]> {
  if (hasToken()) {
    const blobs = await newestCatalogBlob();
    if (blobs.length > 0) {
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { photos?: (Partial<Photo> & { id: string })[] };
        return (data.photos ?? []).map(normalise);
      }
    }
  }
  return (seed.photos as (Partial<Photo> & { id: string })[]).map(normalise);
}

/** Writes a new catalogue file and prunes old ones. The caller revalidates the tag. */
export async function saveCatalog(photos: Photo[]): Promise<void> {
  if (!hasToken()) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await put(`${PREFIX}${stamp}.json`, JSON.stringify({ photos }, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
  const blobs = await newestCatalogBlob();
  const stale = blobs.slice(KEEP).map((b) => b.url);
  if (stale.length) await del(stale);
}

/** Cached read for the visitor pages (hidden ones left out); invalidated with revalidateTag("catalog"). */
export async function getPhotos(): Promise<Photo[]> {
  "use cache";
  cacheTag("catalog");
  return visible(await loadCatalog());
}

/** Removes a photograph's files from the store (best effort). */
export async function deleteFiles(photo: Photo): Promise<void> {
  const urls = [photo.preview.src, photo.full.src].filter((u) => u.includes(".blob.vercel-storage.com"));
  if (urls.length) await del(urls);
}
