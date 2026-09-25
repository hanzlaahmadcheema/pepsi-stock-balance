"use client";

import { useEffect } from "react";
import { IconClose, IconKeyboard } from "@/components/ui/icons";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPosContext?: boolean;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  badge?: string;
}

const POS_SHORTCUTS: ShortcutItem[] = [
  {
    keys: ["F2", "or", "/"],
    description: "Focus Product Search / Barcode Scanner input",
    badge: "Fast Scan",
  },
  {
    keys: ["F3"],
    description: "Open the product catalogue pop-up to browse every product",
    badge: "Browse",
  },
  {
    keys: ["Enter"],
    description: "Auto-add first matched product or scanned barcode SKU to ticket",
    badge: "Scanner",
  },
  {
    keys: ["F4"],
    description: "Focus Customer selector dropdown",
  },
  {
    keys: ["F7"],
    description: "Auto-match returnable empty crates & bottles sold",
    badge: "Empties",
  },
  {
    keys: ["F8"],
    description: "Exact Tender (Paid in Full button)",
    badge: "Quick Cash",
  },
  {
    keys: ["F9"],
    description: "Focus Amount Received / Cash tender input",
  },
  {
    keys: ["Ctrl", "Enter"],
    description: "Finalize & Complete Sale Invoice",
    badge: "Checkout",
  },
  {
    keys: ["Alt", "C"],
    description: "Clear all items from current order ticket",
  },
  {
    keys: ["Esc"],
    description: "Clear search query / Close popups",
  },
];

const GLOBAL_SHORTCUTS: ShortcutItem[] = [
  {
    keys: ["Alt", "N"],
    description: "Go to New Sale (POS Register)",
  },
  {
    keys: ["Alt", "H"],
    description: "Go to Dashboard (Home)",
  },
  {
    keys: ["Alt", "P"],
    description: "Go to Current Stock & Inventory",
  },
  {
    keys: ["Alt", "C"],
    description: "Go to Customers & Accounts",
  },
  {
    keys: ["Alt", "R"],
    description: "Go to Business Reports",
  },
  {
    keys: ["?"],
    description: "Open / Close this Keyboard Shortcuts Cheat Sheet",
  },
];

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
  isPosContext = false,
}: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <IconKeyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                Keyboard Shortcuts Cheat Sheet
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Speed up counter operations and navigation without touching the mouse.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* POS Terminal Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                POS Terminal &amp; Fast Checkout
              </span>
              {isPosContext && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  Active Page
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              {POS_SHORTCUTS.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
                >
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    {item.description}
                    {item.badge && (
                      <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                        {item.badge}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    {item.keys.map((k, ki) =>
                      k === "or" ? (
                        <span key={ki} className="text-xs text-zinc-400 px-0.5">
                          or
                        </span>
                      ) : (
                        <kbd
                          key={ki}
                          className="px-2 py-1 text-xs font-bold font-mono rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 shadow-2xs text-zinc-800 dark:text-zinc-100 min-w-7 text-center"
                        >
                          {k}
                        </kbd>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Global Navigation Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Global ERP Navigation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GLOBAL_SHORTCUTS.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800"
                >
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate pr-2">
                    {item.description}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.keys.map((k, ki) => (
                      <kbd
                        key={ki}
                        className="px-2 py-0.5 text-xs font-bold font-mono rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 shadow-2xs text-zinc-800 dark:text-zinc-100"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs text-zinc-500">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-xs">?</kbd> anywhere to open this dialog</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
