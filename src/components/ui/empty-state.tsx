import React from "react";
import Link from "next/link";
import { IconBox } from "./icons";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  actionLabel,
  actionHref,
  actionOnClick,
  className = "",
}: EmptyStateProps) {
  const resolvedAction =
    action ||
    (actionLabel
      ? { label: actionLabel, href: actionHref, onClick: actionOnClick }
      : undefined);
  return (
    <div
      className={`p-8 sm:p-12 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 ${className}`}
    >
      <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center">
        {icon || <IconBox className="w-5 h-5 text-zinc-400" />}
      </div>
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {resolvedAction && (
        <div className="mt-4">
          {resolvedAction.href ? (
            <Link
              href={resolvedAction.href}
              className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs"
            >
              {resolvedAction.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={resolvedAction.onClick}
              className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              {resolvedAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
