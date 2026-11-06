// Browser-side preparation of an uploaded photograph: a WebP preview for the
// stream and a resized JPEG for the full view. Nothing is sent to a server
// function, so there is no body-size or execution-time limit to hit.

export const PREVIEW_EDGE = 1600;
export const FULL_EDGE = 3000;

export type Prepared = {
  id: string;
  name: string;
  taken: string;
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

export async function takenDate(file: File): Promise<Date | null> {
  try {
    const exifr = (await import("exifr")).default;
    const data = (await exifr.parse(file, ["DateTimeOriginal"])) as { DateTimeOriginal?: Date } | undefined;
    return data?.DateTimeOriginal instanceof Date ? data.DateTimeOriginal : null;
  } catch {
    return null;
  }
}

export async function prepare(file: File): Promise<Prepared> {
  const buf = await file.arrayBuffer();
  const taken = await takenDate(file);
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
      preview: { ...preview, url: URL.createObjectURL(preview.blob) },
      full,
    };
  } finally {
    bitmap.close();
  }
}
