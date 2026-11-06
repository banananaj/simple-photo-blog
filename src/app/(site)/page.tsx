import { Stream } from "@/components/stream";
import { getPhotos } from "@/lib/catalog";

export default async function PhotoPage() {
  const photos = await getPhotos();
  return (
    <>
      <h1 className="visually-hidden">Photographs</h1>
      <Stream photos={photos} />
    </>
  );
}
