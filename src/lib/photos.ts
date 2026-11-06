import data from "@/content/photos.json";

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
};

export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

export const photos: Photo[] = data.photos as Photo[];

export function places(list: Photo[] = photos): string[] {
  return [...new Set(list.map((p) => p.place).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function seasons(list: Photo[] = photos): Season[] {
  const present = new Set(list.map((p) => p.season));
  return SEASONS.filter((s) => present.has(s));
}

export function credits(list: Photo[] = photos): string[] {
  return [...new Set(list.map((p) => p.credit).filter(Boolean))];
}

export type Filter = { season?: string; place?: string };

export function apply(list: Photo[], filter: Filter): Photo[] {
  return list.filter(
    (p) => (!filter.season || p.season === filter.season) && (!filter.place || p.place === filter.place),
  );
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
