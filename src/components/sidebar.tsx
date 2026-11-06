import Link from "next/link";
import { Filter } from "@/components/filter";
import { NavLink } from "@/components/nav-link";
import { photos, places, seasons } from "@/lib/photos";

export function Sidebar() {
  return (
    <header className="side">
      <p className="side-name">
        <Link href="/" aria-label="gidong, home">
          gidong
        </Link>
      </p>
      <nav className="side-nav" aria-label="Site">
        <NavLink href="/">Photo</NavLink>
        <NavLink href="/about">About</NavLink>
      </nav>
      <Filter seasons={seasons(photos)} places={places(photos)} />
    </header>
  );
}
