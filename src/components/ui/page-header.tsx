import React from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  action,
  badge,
  breadcrumb,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {breadcrumb && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
          {breadcrumb}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
