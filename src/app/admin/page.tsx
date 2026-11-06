import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Reached only through the basic-auth gate in src/proxy.ts. The admin's features
// are still to be specified by the owner (PRODUCT.md); this is the route and nothing more.
export default function AdminPage() {
  return (
    <article className="about">
      <h1>Admin</h1>
      <p>Nothing here yet.</p>
    </article>
  );
}
