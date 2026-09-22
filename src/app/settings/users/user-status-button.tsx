"use client";

import { useState, useTransition } from "react";
import { toggleUserStatusAction } from "./actions";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function UserStatusButton({
  userId,
  isActive,
  isSelf,
  userName,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
  userName?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Cannot deactivate yourself
  if (isSelf) {
    return (
      <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
        Your account
      </span>
    );
  }

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const result = await toggleUserStatusAction(userId);
      if (result?.error) {
        setError(result.error);
      }
      setModalOpen(false);
    });
  };

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={isPending}
          className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
            isActive
              ? "bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 border border-red-200 dark:border-red-800"
              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
          }`}
        >
          {isActive ? "Deactivate" : "Activate"}
        </button>

        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>

      <ConfirmModal
        isOpen={modalOpen}
        title={isActive ? "Deactivate User" : "Activate User"}
        description={
          isActive
            ? `Are you sure you want to deactivate ${userName ? `"${userName}"` : "this user"}? They will be signed out and unable to access the system.`
            : `Are you sure you want to reactivate ${userName ? `"${userName}"` : "this user"}? They will regain access to perform daily operations.`
        }
        confirmLabel={isActive ? "Confirm Deactivate" : "Confirm Activate"}
        cancelLabel={isActive ? "Keep Active" : "Keep Inactive"}
        variant={isActive ? "danger" : "primary"}
        isPending={isPending}
        onConfirm={handleToggle}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
