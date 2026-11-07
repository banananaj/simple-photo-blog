// Browser-side preparation of an uploaded photograph: a WebP preview for the
// stream and a resized JPEG for the full view. Nothing is sent to a server
// function, so there is no body-size or execution-time limit to hit.

export const PREVIEW_EDGE = 1600;
export const FULL_EDGE = 3000;

export type Prepared = {
  id: string;
  name: string;
  taken: string;
  /** 1–5 from XMP (xmp:Rating) or the Windows EXIF rating; 1 when absent. */
  rating: number;
  /** Whether the file carried a rating at all (a folder pick stages only rated files). */
  rated: boolean;
  preview: { blob: Blob; width: number; height: number; url: string };
  full: { blob: Blob; width: number; height: number };
};

async function sha1(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fit(w: number, h: number, edge: number): [number, number] {
  const scale = Math.min(1, edge / Math.max(w, h));
  return [Math.round(w * scale), Math.round(h * scale)];
}

async function draw(bitmap: ImageBitmap, edge: number, type: string, quality: number) {
  const [w, h] = fit(bitmap.width, bitmap.height, edge);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error(`could not encode ${type}`);
  return { blob, width: w, height: h };
}

export function seasonOf(date: Date | null): "spring" | "summer" | "autumn" | "winter" | "" {
  if (!date) return "";
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

/** `rating` is null when the file carries none (or a 0, which Lightroom and Windows write for "unrated"). */
export type Meta = { taken: Date | null; rating: number | null };

type Namespaced = {
  xmp?: { Rating?: unknown };
  MicrosoftPhoto?: { Rating?: unknown };
  ifd0?: { Rating?: unknown; RatingPercent?: unknown; 0x4746?: unknown; 0x4749?: unknown };
  exif?: { DateTimeOriginal?: Date };
};

function stars(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null;
}

/** Windows and MicrosoftPhoto store a percentage: 1, 25, 50, 75, 99 for one to five stars. */
function starsFromPercent(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(5, Math.round(n / 25) + 1);
}

/**
 * The star rating, in order of trust: xmp:Rating (what XnView MP, Lightroom,
 * Bridge and digiKam write), then the Windows XMP percentage, then the Windows
 * EXIF tags. The namespaces are read separately on purpose: a merged read lets
 * MicrosoftPhoto:Rating (a percentage, 50 for three stars) overwrite xmp:Rating
 * under the same key, which is how ratings went missing before.
 */
export function pickRating(data: Namespaced | undefined): number | null {
  if (!data) return null;
  return (
    stars(data.xmp?.Rating) ??
    starsFromPercent(data.MicrosoftPhoto?.Rating) ??
    stars(data.ifd0?.Rating ?? data.ifd0?.[0x4746]) ??
    starsFromPercent(data.ifd0?.RatingPercent ?? data.ifd0?.[0x4749])
  );
}

export async function readMeta(file: File | ArrayBuffer): Promise<Meta> {
  try {
    const exifr = (await import("exifr")).default;
    // Whole file, not exifr's chunked first read: an XMP packet behind a large ICC
    // or EXIF segment is otherwise missed.
    const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const data = (await exifr.parse(buf, { tiff: true, exif: true, xmp: true, mergeOutput: false })) as
      | Namespaced
      | undefined;
    const taken = data?.exif?.DateTimeOriginal;
    return { taken: taken instanceof Date ? taken : null, rating: pickRating(data) };
  } catch {
    return { taken: null, rating: null };
  }
}

/** Pass `meta` when it was already read (a rating pre-check) to avoid parsing the file twice. */
export async function prepare(file: File, meta?: Meta): Promise<Prepared> {
  const buf = await file.arrayBuffer();
  const { taken, rating: rawRating } = meta ?? (await readMeta(buf));
  const rating = rawRating ?? 1;
  const stamp = (taken ?? new Date(file.lastModified)).toISOString().slice(0, 10).replaceAll("-", "");
  const id = `${stamp}-${(await sha1(buf)).slice(0, 8)}`;
  const bitmap = await createImageBitmap(new Blob([buf], { type: file.type }), { imageOrientation: "from-image" });
  try {
    const preview = await draw(bitmap, PREVIEW_EDGE, "image/webp", 0.82);
    const full = await draw(bitmap, FULL_EDGE, "image/jpeg", 0.88);
    return {
      id,
      name: file.name,
      taken: taken ? taken.toISOString().slice(0, 10) : "",
      rating,
      rated: rawRating !== null,
      preview: { ...preview, url: URL.createObjectURL(preview.blob) },
      full,
    };
  } finally {
    bitmap.close();
  }
}
