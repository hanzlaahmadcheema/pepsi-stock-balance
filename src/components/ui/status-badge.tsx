import React from "react";

export type BadgeVariant = "success" | "warning" | "info" | "danger" | "neutral";

export interface StatusBadgeProps {
  status?: string;
  variant?: BadgeVariant;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Maps raw database and workflow status strings to standard UI badge variants.
 */
export function getStatusVariant(status: string): BadgeVariant {
  const s = status.toUpperCase();
  switch (s) {
    case "COMPLETED":
    case "CLOSED":
    case "ACTIVE":
    case "POSTED":
    case "READY":
    case "APPROVED":
    case "OPTIMAL":
      return "success";
    case "IN_REVIEW":
    case "QUARANTINED":
    case "PENDING":
    case "PENDING_ADJUSTMENTS":
    case "LOW_STOCK":
    case "CREDIT":
      return "warning";
    case "OPEN":
    case "DRAFT":
    case "IN_PROGRESS":
    case "RETAIL":
    case "WHOLESALE":
    case "KEY_ACCOUNT":
      return "info";
    case "CANCELLED":
    case "REJECTED":
    case "DAMAGED":
    case "EXPIRED":
    case "OUT_OF_STOCK":
    case "DAMAGED_WAREHOUSE":
    case "DAMAGED_RETURN":
      return "danger";
    case "INACTIVE":
    case "NOT_STARTED":
    case "ANONYMOUS":
    default:
      return "neutral";
  }
}

export function StatusBadge({
  status,
  variant,
  label,
  className = "",
  children,
}: StatusBadgeProps) {
  const resolvedVariant = variant || (status ? getStatusVariant(status) : "neutral");
  const displayLabel = label || children || (status ? status.replace(/_/g, " ") : "");

  const variantStyles: Record<BadgeVariant, string> = {
    success:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80",
    warning:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80",
    info:
      "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/80",
    danger:
      "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/80",
    neutral:
      "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  };

  const dotStyles: Record<BadgeVariant, string> = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    info: "bg-blue-500",
    danger: "bg-red-500",
    neutral: "bg-zinc-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantStyles[resolvedVariant]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles[resolvedVariant]}`} />
      <span className="capitalize">{displayLabel}</span>
    </span>
  );
}
