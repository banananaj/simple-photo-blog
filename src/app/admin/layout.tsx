import type { Metadata } from "next";
import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { site } from "@/lib/site";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s — admin — ${site.name}` },
  robots: { index: false, follow: false },
};

// The admin is a tool, not the gallery: its own shell, the same paper and type.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin">
      <header className="admin-bar">
        <p className="admin-name">
          <Link href="/admin">{site.name} admin</Link>
        </p>
        <nav className="admin-nav" aria-label="Admin">
          <NavLink href="/admin">Dashboard</NavLink>
          <NavLink href="/admin/upload">Upload</NavLink>
          <NavLink href="/admin/photos">Photos</NavLink>
          <Link href="/">View site</Link>
        </nav>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
