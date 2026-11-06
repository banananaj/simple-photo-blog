import { Suspense } from "react";
import { Stream } from "@/components/stream";
import { photos } from "@/lib/photos";

export default function PhotoPage() {
  return (
    <>
      <h1 className="visually-hidden">Photographs</h1>
      <Suspense fallback={null}>
        <Stream photos={photos} />
      </Suspense>
    </>
  );
}
