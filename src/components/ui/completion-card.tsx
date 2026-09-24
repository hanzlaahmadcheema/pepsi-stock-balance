import React from "react";
import Link from "next/link";
import { IconReceipt, IconCheckCircle, IconPlus, IconArrowLeft } from "./icons";

export interface CompletionDetailItem {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  color?: "default" | "success" | "warning" | "danger";
}

export interface CompletionCardProps {
  title: string;
  subtitle?: string;
  referenceNumber?: string;
  referenceLabel?: string;
  details?: CompletionDetailItem[];
  primaryAction: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  };
  secondaryActions?: Array<{
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  }>;
  children?: React.ReactNode;
  className?: string;
}

export function CompletionCard({
  title,
  subtitle,
  referenceNumber,
  referenceLabel = "Reference #",
  details = [],
  primaryAction,
  secondaryActions = [],
  children,
  className = "",
}: CompletionCardProps) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm max-w-xl mx-auto text-center animate-in fade-in zoom-in-95 duration-200 ${className}`}
    >
      {/* Success Badge Icon */}
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
        <IconCheckCircle className="w-8 h-8" />
      </div>

      {/* Main Title & Subtitle */}
      <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
          {subtitle}
        </p>
      )}

      {/* Reference Badge */}
      {referenceNumber && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          <span className="text-zinc-400 font-sans font-medium">{referenceLabel}</span>
          <span>{referenceNumber}</span>
        </div>
      )}

      {/* Details Box */}
      {details.length > 0 && (
        <div className="my-6 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 divide-y divide-zinc-200/80 dark:divide-zinc-700/60 text-left text-xs">
          {details.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between py-2.5 first:pt-0 last:pb-0 ${
                item.highlight ? "font-bold text-sm" : ""
              }`}
            >
              <span className="text-zinc-500 dark:text-zinc-400">{item.label}</span>
              <span
                className={`tabular-nums text-right font-medium ${
                  item.color === "success"
                    ? "text-emerald-600 dark:text-emerald-400 font-bold"
                    : item.color === "warning"
                    ? "text-amber-600 dark:text-amber-400 font-bold"
                    : item.color === "danger"
                    ? "text-red-600 dark:text-red-400 font-bold"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {children && <div className="my-4">{children}</div>}

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        {primaryAction.href ? (
          <Link
            href={primaryAction.href}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {primaryAction.icon || <IconPlus className="w-4 h-4" />}
            <span>{primaryAction.label}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {primaryAction.icon || <IconPlus className="w-4 h-4" />}
            <span>{primaryAction.label}</span>
          </button>
        )}

        {secondaryActions.map((sec, idx) =>
          sec.href ? (
            <Link
              key={idx}
              href={sec.href}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {sec.icon}
              <span>{sec.label}</span>
            </Link>
          ) : (
            <button
              key={idx}
              type="button"
              onClick={sec.onClick}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {sec.icon}
              <span>{sec.label}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
