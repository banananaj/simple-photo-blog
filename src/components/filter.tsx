"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { filterFromPath, filterHref, type FilterKind } from "@/lib/photos";

type Props = { seasons: string[]; places: string[]; tags: string[] };

// The filter stays folded; a reader who wants it opens it. A filter is a page of
// its own (/season/winter, /place/Jeju, /tag/snow), so every view is static and
// shareable and the stream is in the HTML without a script.
export function Filter({ seasons, places, tags }: Props) {
  const pathname = usePathname();
  const current = filterFromPath(pathname);
  if (pathname !== "/" && !current) return null;

  // Each group folds on its own; the group holding the current filter starts open.
  const group = (label: string, kind: FilterKind, values: string[]) =>
    values.length > 0 && (
      <details className="filter-group" open={!current || current.kind === kind ? true : undefined}>
        <summary className="filter-head">{label}</summary>
        <ul>
          {values.map((v) => {
            const on = current?.kind === kind && current.value === v;
            return (
              <li key={v}>
                <Link href={on ? "/" : filterHref({ kind, value: v })} aria-current={on ? "true" : undefined}>
                  {v}
                </Link>
              </li>
            );
          })}
        </ul>
      </details>
    );

  return (
    <details className="filter" open={current ? true : undefined}>
      <summary>{current ? "Filtered" : "Filter"}</summary>
      <div className="filter-groups">
        {group("Season", "season", seasons)}
        {group("Tag", "tag", tags)}
        {group("Place", "place", places)}
        {current && (
          <p className="filter-clear">
            <Link href="/">Show everything</Link>
          </p>
        )}
      </div>
    </details>
  );
}
