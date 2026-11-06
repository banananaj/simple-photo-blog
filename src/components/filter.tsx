"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Props = { seasons: string[]; places: string[] };

// The filter stays folded; a reader who wants it opens it. Its state lives in the
// URL (?season=…&place=…) so a filtered view can be shared and reloaded.
export function Filter({ seasons, places }: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const season = params.get("season") ?? "";
  const place = params.get("place") ?? "";
  const active = season || place;
  if (pathname !== "/") return null;

  const href = (next: { season?: string; place?: string }) => {
    const q = new URLSearchParams();
    const s = next.season ?? season;
    const p = next.place ?? place;
    if (s) q.set("season", s);
    if (p) q.set("place", p);
    const qs = q.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <details className="filter" open={Boolean(active) || undefined}>
      <summary>{active ? "Filtered" : "Filter"}</summary>
      <div className="filter-groups">
        <div className="filter-group">
          <p className="filter-head">Season</p>
          <ul>
            {seasons.map((s) => (
              <li key={s}>
                <Link href={href({ season: s === season ? "" : s })} aria-current={s === season ? "true" : undefined}>
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="filter-group">
          <p className="filter-head">Place</p>
          <ul>
            {places.map((p) => (
              <li key={p}>
                <Link href={href({ place: p === place ? "" : p })} aria-current={p === place ? "true" : undefined}>
                  {p}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {active && (
          <p className="filter-clear">
            <Link href="/">Show everything</Link>
          </p>
        )}
      </div>
    </details>
  );
}
