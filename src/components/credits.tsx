import { getPhotos } from "@/lib/catalog";
import { credits } from "@/lib/photos";

// Library stand-ins carry a credit (Hallmark gate 76). Folded, at the foot of the
// page; it disappears on its own once every photograph is the owner's.
export async function Credits() {
  const lines = credits(await getPhotos());
  if (lines.length === 0) return null;
  return (
    <footer className="credits">
      <details>
        <summary>Photo credits</summary>
        <ul>
          {lines.map((c) => (
            <li key={c} dangerouslySetInnerHTML={{ __html: c }} />
          ))}
        </ul>
      </details>
    </footer>
  );
}
