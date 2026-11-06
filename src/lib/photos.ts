export type Season = "spring" | "summer" | "autumn" | "winter";

export type ImageFile = { src: string; width: number; height: number };

export type Photo = {
  id: string;
  preview: ImageFile;
  full: ImageFile;
  place: string;
  season: Season | "";
  taken: string;
  alt: string;
  credit: string;
  tags: string[];
  /** Uploaded but not shown to visitors. */
  hidden?: boolean;
  uploadedAt?: string;
};

/** What visitors may see. */
export function visible(list: Photo[]): Photo[] {
  return list.filter((p) => !p.hidden);
}

export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

export function places(list: Photo[]): string[] {
  return [...new Set(list.map((p) => p.place).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function seasons(list: Photo[]): Season[] {
  const present = new Set(list.map((p) => p.season));
  return SEASONS.filter((s) => present.has(s));
}

export function tags(list: Photo[]): string[] {
  return [...new Set(list.flatMap((p) => p.tags ?? []))].sort((a, b) => a.localeCompare(b));
}

export function credits(list: Photo[]): string[] {
  return [...new Set(list.map((p) => p.credit).filter(Boolean))];
}

/** Full-size file as an attachment: Vercel Blob honours ?download=1; S3 objects carry Content-Disposition. */
export function downloadHref(photo: Photo): string {
  const src = photo.full.src;
  return src.includes(".blob.vercel-storage.com") ? `${src}${src.includes("?") ? "&" : "?"}download=1` : src;
}

export type Filter = { season?: string; place?: string; tag?: string };

export function apply(list: Photo[], filter: Filter): Photo[] {
  return list.filter(
    (p) =>
      (!filter.season || p.season === filter.season) &&
      (!filter.place || p.place === filter.place) &&
      (!filter.tag || (p.tags ?? []).includes(filter.tag)),
  );
}

export function filterHref(filter: Filter): string {
  const q = new URLSearchParams();
  if (filter.season) q.set("season", filter.season);
  if (filter.place) q.set("place", filter.place);
  if (filter.tag) q.set("tag", filter.tag);
  const qs = q.toString();
  return qs ? `/?${qs}` : "/";
}

/** "a, b ,c" → ["a", "b", "c"], trimmed, lower-cased, deduplicated. */
export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(list: T[], random: () => number = Math.random): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
