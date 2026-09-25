"use client";

import { useRef, useEffect, useState, ReactNode } from "react";

export function ScrollableTable({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hasRightOverflow, setHasRightOverflow] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const checkOverflow = () => {
    const el = wrapperRef.current;
    if (!el) return;
    const overflowing = el.scrollWidth > el.clientWidth + 2;
    setHasRightOverflow(overflowing);
    if (overflowing) {
      setScrolledToEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    }
  };

  useEffect(() => {
    checkOverflow();
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative">
      <div ref={wrapperRef} className="overflow-x-auto" onScroll={checkOverflow}>
        {children}
      </div>
      {hasRightOverflow && !scrolledToEnd && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bottom-7 right-0 w-10 bg-gradient-to-l from-white dark:from-zinc-900 to-transparent"
        />
      )}
      {hasRightOverflow && (
        <div className="lg:hidden text-xs font-medium text-zinc-500 dark:text-zinc-400 px-4 py-1.5 bg-zinc-50/80 dark:bg-zinc-800/40 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-end gap-1 select-none">
          <span>Scroll horizontally for more</span>
          <span aria-hidden="true">&rarr;</span>
        </div>
      )}
    </div>
  );
}
