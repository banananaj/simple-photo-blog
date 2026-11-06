import { Suspense } from "react";
import { Credits } from "@/components/credits";
import { Sidebar } from "@/components/sidebar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <main id="main" className="main">
        {children}
        <Suspense fallback={null}>
          <Credits />
        </Suspense>
      </main>
    </div>
  );
}
