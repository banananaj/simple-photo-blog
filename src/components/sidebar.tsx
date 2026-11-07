import Link from "next/link";
import { Filter } from "@/components/filter";
import { NavLink } from "@/components/nav-link";
import { getPhotos } from "@/lib/catalog";
import { places, seasons, tags } from "@/lib/photos";
import { site } from "@/lib/site";

export async function Sidebar() {
  const photos = await getPhotos();
  return (
    <header className="side">
      <p className="side-name">
        <Link href="/" aria-label={`${site.name}, home`}>
          {site.name}
        </Link>
      </p>
      <nav className="side-nav" aria-label="Site">
        <NavLink href="/">Photo</NavLink>
        <NavLink href="/about">About</NavLink>
      </nav>
      <Filter seasons={seasons(photos)} places={places(photos)} tags={tags(photos)} />
    </header>
  );
}
