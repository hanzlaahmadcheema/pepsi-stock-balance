"use client";

import { useTextSize, type TextSize } from "@/lib/ui-preferences";

const OPTIONS: { value: TextSize; glyph: string; label: string; glyphClass: string }[] = [
  { value: "medium", glyph: "A", label: "Normal text size", glyphClass: "text-base" },
  { value: "large", glyph: "A+", label: "Large text size", glyphClass: "text-xl" },
  { value: "largest", glyph: "A++", label: "Largest text size", glyphClass: "text-2xl" },
];

/**
 * Reading-size control. The whole application is measured in rem, so choosing
 * a size here enlarges type, buttons, fields and table rows together and the
 * choice survives sign-out.
 */
export function TextSizeControl({ compact = false }: { compact?: boolean }) {
  const [size, choose] = useTextSize();

  return (
    <div role="group" aria-label="Text size" className={`flex items-center ${compact ? "gap-1" : "gap-1.5"}`}>
      {!compact && (
        <span className="hidden text-sm font-bold text-ink-2 xl:inline">Text Size</span>
      )}
      <div className="flex items-stretch gap-1">
        {OPTIONS.map((option) => {
          const selected = size === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => choose(option.value)}
              aria-pressed={selected}
              title={option.label}
              aria-label={option.label}
              className={`flex min-w-12 items-center justify-center rounded-md border-2 px-2 font-bold leading-none transition-colors ${option.glyphClass} ${
                selected
                  ? "border-navy-deep bg-navy text-white"
                  : "border-rule-strong bg-surface text-ink hover:bg-surface-alt"
              }`}
              style={{ minHeight: "2.75rem" }}
            >
              <span aria-hidden="true">{option.glyph}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
