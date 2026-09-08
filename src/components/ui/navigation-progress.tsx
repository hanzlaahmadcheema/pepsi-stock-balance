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

  // Intercept click on any internal links
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

        // Start loading progress immediately (0ms)
        setIsLoading(true);
        setProgress(25);
      }
    };

    // Intercept form submissions to also show progress
    const handleFormSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (form && !form.getAttribute("target")) {
        setIsLoading(true);
        setProgress(35);
      }
    };

    document.addEventListener("click", handleLinkClick, true);
    document.addEventListener("submit", handleFormSubmit, true);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
      document.removeEventListener("submit", handleFormSubmit, true);
    };
  }, []);

  // Animate progress incrementally while loading
  useEffect(() => {
    if (!isLoading) return;

    const t1 = setTimeout(() => setProgress((p) => Math.max(p, 45)), 150);
    const t2 = setTimeout(() => setProgress((p) => Math.max(p, 70)), 500);
    const t3 = setTimeout(() => setProgress((p) => Math.max(p, 85)), 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isLoading]);

  if (progress === 0 && !isLoading) return null;

  return (
    <>
      {/* 1. Ultra-responsive Top Bar Glowing Progress Indicator */}
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

      {/* 2. Floating Sleek Loading Badge in Bottom-Right */}
      {isLoading && (
        <div className="fixed bottom-5 right-5 z-[99998] pointer-events-none flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-zinc-900/90 dark:bg-zinc-800/95 text-white shadow-xl border border-zinc-700/60 backdrop-blur-md text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <svg
            className="w-4 h-4 animate-spin text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading workspace...</span>
        </div>
      )}
    </>
  );
}
