// Site identity, from the environment so the code stays a template.
// NEXT_PUBLIC_* values are inlined at build time; set them on Vercel (or in
// .env.local) before building. Nothing here is specific to one owner.

const name = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "photos";
const url = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "";

export const site = {
  /** The name in the sidebar, the browser title and the download file names. */
  name,
  /** Public origin, e.g. https://example.com; empty until a domain is set. */
  url,
  /** One sentence for search engines and link previews. */
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim() || `Photographs by ${name}, shown in no particular order.`,
  /** A file-name-safe form of the name: "My Site" → "my-site". */
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "photo",
};
