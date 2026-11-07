"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Lightbox state tied to browser history. Opening the full view pushes an
 * entry, so the browser's Back closes it instead of leaving the page; Close
 * and Escape go back the same way. Leaving for another page from inside the
 * view replaces that entry, so Back from there returns to the stream.
 */
export function useLightbox() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);

  const openBox = (i: number) => {
    window.history.pushState({ ...(window.history.state ?? {}), lightbox: true }, "");
    setOpen(i);
  };
  const closeBox = () => {
    if (window.history.state?.lightbox) window.history.back();
    else setOpen(null);
  };
  const leaveTo = (href: string) => {
    setOpen(null);
    router.replace(href);
  };

  useEffect(() => {
    const onPop = () => setOpen(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { open, setOpen, openBox, closeBox, leaveTo };
}
