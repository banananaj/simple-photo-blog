"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { filterHref } from "@/lib/photos";

type Props = { seasons: string[]; places: string[]; tags: string[] };

// The filter stays folded; a reader who wants it opens it. Its state lives in the
// URL (?season=…&place=…&tag=…) so a filtered view can be shared and reloaded.
export function Filter({ seasons, places, tags }: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const current = { season: params.get("season") ?? "", place: params.get("place") ?? "", tag: params.get("tag") ?? "" };
  const active = current.season || current.place || current.tag;
  if (pathname !== "/") return null;

  const group = (label: string, key: keyof typeof current, values: string[]) =>
    values.length > 0 && (
      <div className="filter-group">
        <p className="filter-head">{label}</p>
        <ul>
          {values.map((v) => (
            <li key={v}>
              <Link
                href={filterHref({ ...current, [key]: v === current[key] ? "" : v })}
                aria-current={v === current[key] ? "true" : undefined}
              >
                {v}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <details className="filter" open={Boolean(active) || undefined}>
      <summary>{active ? "Filtered" : "Filter"}</summary>
      <div className="filter-groups">
        {group("Season", "season", seasons)}
        {group("Place", "place", places)}
        {group("Tag", "tag", tags)}
        {active && (
          <p className="filter-clear">
            <Link href="/">Show everything</Link>
          </p>
        )}
      </div>
    </details>
  );
}
