"use client";

import { useActionState, useEffect, useRef } from "react";
import { Role } from "@prisma/client";
import { updateStaffUserAction } from "./actions";
import { IconClose } from "@/components/ui/icons";

export interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  /** Pass the current logged-in owner's ID to prevent self-role-change */
  currentUserId: string;
}

export function EditUserModal({ isOpen, onClose, user, currentUserId }: EditUserModalProps) {
  const [state, formAction, isPending] = useActionState(updateStaffUserAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const isSelf = user.id === currentUserId;

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        onClose();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [state?.success, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-md w-full overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-staff-modal-title"
      >
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 id="edit-staff-modal-title" className="font-semibold text-zinc-900 dark:text-zinc-50">
              Edit User
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Update name, login credentials, or role
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        <form ref={formRef} action={formAction} className="p-6 space-y-4">
          <input type="hidden" name="userId" value={user.id} />

          {state?.error && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="p-3 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">
              {state.message || "User updated successfully!"}
            </div>
          )}

          <div>
            <label
              htmlFor="edit-staff-name"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1"
            >
              Full Name *
            </label>
            <input
              id="edit-staff-name"
              type="text"
              name="name"
              defaultValue={user.name}
              required
              minLength={2}
              placeholder="e.g. Tariq Khan"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="edit-staff-email"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1"
            >
              Username or Email *
            </label>
            <input
              id="edit-staff-email"
              type="text"
              name="email"
              defaultValue={
                user.email === "—"
                  ? ""
                  : user.email.endsWith("@pepsidepot.local")
                  ? user.email.replace("@pepsidepot.local", "")
                  : user.email
              }
              required
              placeholder="e.g. tariq or tariq@distribution.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="edit-staff-role"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1"
            >
              Role
            </label>
            <select
              id="edit-staff-role"
              name="role"
              defaultValue={user.role}
              disabled={isSelf}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="STAFF">Staff</option>
              <option value="OWNER">Owner (Admin)</option>
            </select>
            {isSelf && (
              <p className="text-[11px] text-zinc-500 mt-1">
                You cannot change your own role.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="edit-staff-password"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1"
            >
              New Password (Optional)
            </label>
            <input
              id="edit-staff-password"
              type="password"
              name="password"
              minLength={8}
              placeholder="Leave blank to keep unchanged (min 8 chars)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Only fill this if you want to reset this user&apos;s login password.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {isPending && (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
