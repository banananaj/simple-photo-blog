import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { loadCatalog } from "@/lib/catalog";
import { SEASONS, tags as allTags } from "@/lib/photos";
import { getViews, viewsEnabled } from "@/lib/views";

export const metadata = { title: "Dashboard" };

async function Dashboard() {
  await connection();
  const photos = await loadCatalog();
  const views = await getViews().catch(() => null);
  const bySeason = SEASONS.map((s) => [s, photos.filter((p) => p.season === s).length] as const);
  const hidden = photos.filter((p) => p.hidden).length;
  const untagged = photos.filter((p) => p.tags.length === 0).length;
  const noPlace = photos.filter((p) => !p.place).length;
  const tagCounts = allTags(photos)
    .map((t) => [t, photos.filter((p) => p.tags.includes(t)).length] as const)
    .sort((a, b) => b[1] - a[1]);
  const top = views
    ? Object.entries(views.byPhoto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, n]) => ({ id, n, photo: photos.find((p) => p.id === id) }))
    : [];
  const days = views
    ? Object.entries(views.byDay)
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, 14)
    : [];

  return (
    <>
      <section className="admin-section">
        <h2>Photographs</h2>
        <dl className="admin-stats">
          <div>
            <dt>Total</dt>
            <dd className="num">{photos.length}</dd>
          </div>
          {bySeason.map(([s, n]) => (
            <div key={s}>
              <dt>{s}</dt>
              <dd className="num">{n}</dd>
            </div>
          ))}
          <div>
            <dt>Hidden</dt>
            <dd className="num">{hidden}</dd>
          </div>
          <div>
            <dt>Without tags</dt>
            <dd className="num">{untagged}</dd>
          </div>
          <div>
            <dt>Without place</dt>
            <dd className="num">{noPlace}</dd>
          </div>
        </dl>
        {tagCounts.length > 0 && (
          <ul className="admin-tagcloud">
            {tagCounts.map(([t, n]) => (
              <li key={t}>
                <Link href={`/tag/${encodeURIComponent(t)}`}>{t}</Link> <span className="num">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-section">
        <h2>Views</h2>
        {!viewsEnabled && (
          <p>
            View counting is off: no Redis store is connected. Add an Upstash Redis (or Vercel KV) resource to the
            project and the counters start on the next deploy.
          </p>
        )}
        {viewsEnabled && !views && <p>The view store did not answer.</p>}
        {views && (
          <>
            <dl className="admin-stats">
              <div>
                <dt>Full-size opens</dt>
                <dd className="num">{views.total}</dd>
              </div>
            </dl>
            {days.length > 0 && (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th className="num">Opens</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map(([d, n]) => (
                    <tr key={d}>
                      <td>{d}</td>
                      <td className="num">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {top.length > 0 && (
              <ul className="admin-top">
                {top.map(({ id, n, photo }, i) => (
                  <li key={id}>
                    {photo ? (
                      <img
                        src={photo.preview.src}
                        alt={photo.alt}
                        width={120}
                        height={Math.round((120 * photo.preview.height) / photo.preview.width)}
                        loading={i === 0 ? "eager" : "lazy"}
                      />
                    ) : (
                      <span className="admin-gone">removed</span>
                    )}
                    <span>{photo?.place || id}</span>
                    <span className="num">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}

export default function AdminPage() {
  return (
    <>
      <h1>Dashboard</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}
