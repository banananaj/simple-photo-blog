import type { Metadata } from "next";
import { Wall } from "@/components/wall";
import { getPhotos } from "@/lib/catalog";

// Unlisted: reached by its address only, no sidebar, nothing but the wall.
export const metadata: Metadata = {
  title: "Wall",
  robots: { index: false, follow: false },
};

export default async function GridViewPage() {
  const photos = await getPhotos();
  return (
    <>
      <h1 className="visually-hidden">Photographs, as a wall</h1>
      <Wall photos={photos} />
    </>
  );
}
