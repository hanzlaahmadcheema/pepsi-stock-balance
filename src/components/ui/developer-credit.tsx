import React from "react";
import { IconWhatsApp } from "./icons";

export const DEVELOPER_CREDIT = {
  name: "Hanzla Ahmad",
  whatsappNumber: "+92 326 6900001",
  whatsappUrl: "https://wa.me/923266900001",
  displayLabel: "-----By Hanzla Ahmad",
};

interface DeveloperCreditProps {
  variant?: "inline" | "sidebar" | "drawer" | "footer" | "card";
  className?: string;
}

export function DeveloperCredit({
  variant = "inline",
  className = "",
}: DeveloperCreditProps) {
  if (variant === "sidebar") {
    return (
      <a
        href={DEVELOPER_CREDIT.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Contact developer Hanzla Ahmad on WhatsApp (+92 326 6900001)"
        className={`group flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors ${className}`}
      >
        <IconWhatsApp className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" />
        <span className="truncate">{DEVELOPER_CREDIT.displayLabel}</span>
      </a>
    );
  }

  if (variant === "drawer") {
    return (
      <a
        href={DEVELOPER_CREDIT.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Contact developer Hanzla Ahmad on WhatsApp (+92 326 6900001)"
        className={`flex items-center justify-between p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors ${className}`}
      >
        <div className="flex items-center gap-2">
          <IconWhatsApp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{DEVELOPER_CREDIT.displayLabel}</span>
        </div>
        <span className="text-[10px] uppercase font-mono tracking-wider opacity-80">
          WhatsApp
        </span>
      </a>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
      >
        <div className="space-y-0.5">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            System Architecture &amp; Engineering
          </div>
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Pepsi Stock Balance Application
          </div>
        </div>

        <a
          href={DEVELOPER_CREDIT.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <IconWhatsApp className="w-4 h-4" />
          <span>{DEVELOPER_CREDIT.displayLabel}</span>
        </a>
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <div
        className={`py-3 text-center border-t border-zinc-200/80 dark:border-zinc-800/80 text-xs text-zinc-500 dark:text-zinc-400 ${className}`}
      >
        <div className="flex items-center justify-center gap-2">
          <span>Pepsi Stock Balance System</span>
          <span>•</span>
          <a
            href={DEVELOPER_CREDIT.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <IconWhatsApp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{DEVELOPER_CREDIT.displayLabel}</span>
          </a>
        </div>
      </div>
    );
  }

  // Default "inline"
  return (
    <a
      href={DEVELOPER_CREDIT.whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Contact developer Hanzla Ahmad on WhatsApp"
      className={`inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors ${className}`}
    >
      <IconWhatsApp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      <span>{DEVELOPER_CREDIT.displayLabel}</span>
    </a>
  );
}
