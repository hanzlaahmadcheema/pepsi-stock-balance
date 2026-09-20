"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { TechnicalServicesForm } from "./technical-services-form";
import { IconLifebuoy, IconClose, IconWhatsApp } from "@/components/ui/icons";

export function TechnicalServicesWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // If already on the dedicated /technical-services page, hide the floating button
  if (pathname === "/technical-services") {
    return null;
  }

  // Handle ESC key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 print:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-zinc-900/90 dark:bg-white/90 text-white dark:text-zinc-900 font-semibold text-xs sm:text-sm shadow-lg shadow-zinc-900/20 dark:shadow-black/40 hover:bg-zinc-900 dark:hover:bg-white hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-md border border-white/10 dark:border-zinc-200/20"
          aria-label="Need Technical Services? Open support form or WhatsApp"
        >
          <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 dark:text-blue-600 flex items-center justify-center shrink-0">
            <IconLifebuoy className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span>Need Technical Services?</span>
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/30 group-hover:rotate-12 transition-transform">
            <IconWhatsApp className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Modal / Slide-Over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto print:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
            <div
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transform transition-all duration-300 animate-in zoom-in-95"
              role="dialog"
              aria-modal="true"
              aria-labelledby="technical-modal-title"
            >
              {/* Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-blue-600/5 via-transparent to-emerald-500/5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                    <IconLifebuoy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      id="technical-modal-title"
                      className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50"
                    >
                      Need Any Technical Services?
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Fill the form below or message directly on WhatsApp
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  aria-label="Close technical services modal"
                >
                  <IconClose className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 sm:p-8 max-h-[80vh] overflow-y-auto">
                <TechnicalServicesForm onSuccess={() => {}} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
