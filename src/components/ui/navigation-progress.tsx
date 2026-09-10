"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Complete loading when pathname or search parameters change
  useEffect(() => {
    setIsLoading(false);
    setProgress(100);
    const timer = setTimeout(() => {
      setProgress(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  // Intercept click on internal navigation links only
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;

      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");

      // Only handle internal navigation links
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !href.startsWith("/#") &&
        href !== "#" &&
        (!targetAttr || targetAttr === "_self")
      ) {
        // If clicking the current path, no need to trigger loading
        const currentUrl = window.location.pathname + window.location.search;
        if (href === currentUrl) return;

        // Start loading progress
        setIsLoading(true);
        setProgress(30);
      }
    };

    document.addEventListener("click", handleLinkClick, true);
    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, []);

  // Animate progress incrementally while loading
  useEffect(() => {
    if (!isLoading) return;

    const t1 = setTimeout(() => setProgress((p) => Math.max(p, 55)), 150);
    const t2 = setTimeout(() => setProgress((p) => Math.max(p, 75)), 500);
    const t3 = setTimeout(() => setProgress((p) => Math.max(p, 88)), 1200);

    // Failsafe: auto-clear after 3.5s so progress bar never stays stuck
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      setProgress(100);
      setTimeout(() => setProgress(0), 300);
    }, 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(safetyTimer);
    };
  }, [isLoading]);

  if (progress === 0 && !isLoading) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none transition-opacity duration-300"
      style={{ opacity: progress === 100 ? 0 : 1 }}
    >
      <div
        className="h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-indigo-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? "150ms" : "300ms",
        }}
      />
    </div>
  );
}
