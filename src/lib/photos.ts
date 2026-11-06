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

export type FilterKind = "season" | "place" | "tag";
export const FILTER_KINDS: FilterKind[] = ["season", "place", "tag"];

/** One dimension at a time: /season/winter, /place/Jeju, /tag/snow. Static pages, no query string. */
export type Filter = { kind: FilterKind; value: string } | null;

export function apply(list: Photo[], filter: Filter): Photo[] {
  if (!filter) return list;
  const { kind, value } = filter;
  return list.filter((p) =>
    kind === "season" ? p.season === value : kind === "place" ? p.place === value : (p.tags ?? []).includes(value),
  );
}

export function filterHref(filter: Filter): string {
  return filter ? `/${filter.kind}/${encodeURIComponent(filter.value)}` : "/";
}

/** Reads a filter back from a pathname; null for anything that is not a filter page. */
export function filterFromPath(pathname: string): Filter {
  const m = pathname.match(/^\/(season|place|tag)\/([^/]+)$/);
  if (!m) return null;
  try {
    return { kind: m[1] as FilterKind, value: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
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
