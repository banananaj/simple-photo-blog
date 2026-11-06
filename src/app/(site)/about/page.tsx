import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

// The owner writes this page. Until then it stays empty on purpose: no invented
// biography, no placeholder paragraph (PRODUCT.md, Evidence on Hand).
export default function AboutPage() {
  return (
    <article className="about">
      <h1>About</h1>
    </article>
  );
}
