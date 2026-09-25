"use client";

import React, { useEffect, useRef } from "react";
import { IconAlertTriangle, IconClose } from "./icons";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "warning";
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The one dialog every destructive action in the software asks through. It
 * always names the action on the button, and "No, go back" is offered first so
 * a stray tap cannot destroy anything.
 */
export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = "Yes, do it",
  cancelLabel = "No, go back",
  variant = "danger",
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const accent =
    variant === "danger" ? "border-stamp bg-stamp-wash" : variant === "warning" ? "border-warn bg-warn-wash" : "border-navy bg-navy-wash";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center sm:p-6">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-description"
        className="panel my-auto w-full max-w-lg"
      >
        <div className="flex items-start gap-3 border-b-2 border-rule bg-surface-alt px-5 py-4">
          <span
            aria-hidden="true"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 ${accent}`}
          >
            <IconAlertTriangle className="h-7 w-7 text-ink" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-modal-title" className="text-xl font-bold text-ink">
              {title}
            </h3>
            <p id="confirm-modal-description" className="mt-1.5 text-base leading-relaxed text-ink-2">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn shrink-0 px-3"
            aria-label="Close without doing anything"
          >
            <IconClose className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn btn-lg"
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`btn btn-lg ${variant === "danger" ? "btn-danger" : variant === "warning" ? "btn-warn" : "btn-primary"}`}
          >
            {isPending ? "Working, please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
