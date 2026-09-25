import Link from "next/link";
import type { ReactNode } from "react";

/* =========================================================================
   CLASSIC SCREEN PRIMITIVES
   Shared building blocks for the "Printed Ledger" design language so that
   every screen reads like a page from the same depot register book:
   plain words, visible edges, one clear primary action per section.
   ========================================================================= */

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink-2",
  good: "text-good",
  warn: "text-warn",
  bad: "text-stamp",
  info: "text-navy",
};

/* --- Status: the word is always written out; colour only supports it ------- */
export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** Turn a raw workflow status into a tone a person can read at a glance. */
export function statusTone(status: string): Tone {
  const value = status.toUpperCase();
  if (["CLOSED", "COMPLETED", "READY", "PAID", "RECEIVED", "APPROVED", "ACTIVE", "OK"].includes(value)) {
    return "good";
  }
  if (["IN_REVIEW", "PENDING", "PENDING_ADJUSTMENTS", "PARTIAL", "DRAFT"].includes(value)) return "warn";
  if (["OPEN", "IN_PROGRESS", "PROCESSING", "SUBMITTED"].includes(value)) return "info";
  if (["CANCELLED", "FAILED", "OVERDUE", "REJECTED", "QUARANTINED", "OUT_OF_STOCK"].includes(value)) {
    return "bad";
  }
  return "neutral";
}

/** Human sentence for a workflow status — no codes a newcomer has to decode. */
export function statusLabel(status: string): string {
  const value = status.toUpperCase();
  const labels: Record<string, string> = {
    NOT_STARTED: "Not started",
    OPEN: "Open",
    IN_PROGRESS: "In progress",
    IN_REVIEW: "Waiting for approval",
    CLOSED: "Closed",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    PENDING: "Pending",
    PENDING_ADJUSTMENTS: "Adjustments waiting",
    READY: "Ready",
    DRAFT: "Draft",
    PAID: "Paid",
    PARTIAL: "Part paid",
    OVERDUE: "Overdue",
    QUARANTINED: "In quarantine",
    OUT_OF_STOCK: "Out of stock",
    LOW_STOCK: "Low stock",
    ACTIVE: "Active",
    INACTIVE: "Not in use",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return labels[value] ?? status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/* --- Section title: a printed rule with the count on the right ------------- */
export function SectionTitle({
  children,
  aside,
  id,
}: {
  children: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2
        id={id}
        className="text-sm font-bold uppercase tracking-wider text-ink-2 border-b-2 border-rule pb-1.5 flex-1 min-w-40"
      >
        {children}
      </h2>
      {aside ? <div className="text-sm text-ink-3">{aside}</div> : null}
    </div>
  );
}

/* --- Metric card: one number, one label, one place to go next --------------- */
export function StatCard({
  label,
  value,
  unit,
  tone = "neutral",
  badge,
  note,
  actions,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: Tone;
  badge?: ReactNode;
  note?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-rule px-4 py-2.5">
        <span className="text-sm font-bold uppercase tracking-wider text-ink-2">{label}</span>
        {badge}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
        <p className={`num text-3xl font-bold leading-none ${TONE_TEXT[tone]}`}>
          {value}
          {unit ? <span className="ml-2 text-base font-semibold text-ink-3">{unit}</span> : null}
        </p>
        {note ? <div className="text-sm leading-snug text-ink-2">{note}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t-2 border-rule px-4 py-2.5 text-sm">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/* --- Quick action: a big labelled key that says exactly what it does ------- */
export function ActionTile({
  href,
  title,
  hint,
  icon,
  emphasis = false,
}: {
  href: string;
  title: string;
  hint: string;
  icon?: ReactNode;
  emphasis?: boolean;
}) {
  const shell = emphasis
    ? "border-navy-deep bg-navy text-white hover:bg-navy-deep"
    : "border-rule bg-surface text-ink hover:bg-surface-alt";

  return (
    <Link
      href={href}
      className={`group flex min-h-28 flex-col justify-between gap-2 rounded-lg border-2 p-4 transition-colors ${shell}`}
    >
      <div className="flex items-center gap-2">
        {icon ? (
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 ${
              emphasis ? "border-white/50 text-white" : "border-rule text-navy"
            }`}
          >
            {icon}
          </span>
        ) : null}
        <span className={`text-lg font-bold leading-tight ${emphasis ? "text-white" : "text-ink"}`}>
          {title}
        </span>
      </div>
      <span className={`text-sm leading-snug ${emphasis ? "text-white/90" : "text-ink-2"}`}>{hint}</span>
    </Link>
  );
}

/* --- Empty state: says what is missing and how to get it -------------------- */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-rule-strong bg-surface-alt px-6 py-10 text-center">
      <p className="text-lg font-bold text-ink">{title}</p>
      <p className="max-w-prose text-base text-ink-2">{hint}</p>
      {action}
    </div>
  );
}

/* --- Figure box: a small labelled number inside a panel --------------------- */
export function FigureBox({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border-2 border-rule bg-surface-alt px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold uppercase tracking-wider text-ink-3">{label}</span>
        {icon ? (
          <span aria-hidden="true" className="shrink-0 text-ink-3">
            {icon}
          </span>
        ) : null}
      </div>
      <p className={`num mt-1.5 text-xl font-bold ${TONE_TEXT[tone]}`}>{value}</p>
    </div>
  );
}
