import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Stream } from "@/components/stream";
import { getPhotos } from "@/lib/catalog";
import { apply, FILTER_KINDS, places, seasons, tags, type FilterKind } from "@/lib/photos";

type Params = { kind: string; value: string };

// One static page per filter value: /season/winter, /place/Jeju, /tag/snow.
// Values go back raw; Next encodes them for the path and hands them back decoded.
export async function generateStaticParams(): Promise<Params[]> {
  const photos = await getPhotos();
  return [
    ...seasons(photos).map((v) => ({ kind: "season", value: v })),
    ...places(photos).map((v) => ({ kind: "place", value: v })),
    ...tags(photos).map((v) => ({ kind: "tag", value: v })),
  ];
}

function read(params: Params): { kind: FilterKind; value: string } | null {
  if (!(FILTER_KINDS as string[]).includes(params.kind)) return null;
  try {
    return { kind: params.kind as FilterKind, value: decodeURIComponent(params.value) };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const f = read(await params);
  return { title: f ? f.value : "Photographs" };
}

export default async function FilteredPage({ params }: { params: Promise<Params> }) {
  const filter = read(await params);
  if (!filter) notFound();
  const photos = apply(await getPhotos(), filter);
  return (
    <>
      <h1 className="visually-hidden">
        Photographs, {filter.kind} {filter.value}
      </h1>
      <Stream photos={photos} />
    </>
  );
}
