"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createStaffUserAction } from "./actions";

export function CreateStaffUserForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"STAFF" | "OWNER">("STAFF");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(createStaffUserAction, null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setSelectedRole("STAFF");
      const timer = setTimeout(() => setIsOpen(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [state?.success]);

  return (
    <div className="mb-6">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      ) : (
        <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Provision New Account
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Create a Staff or Owner account. Owners have full administrative access.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form ref={formRef} action={formAction} className="space-y-4">
            {state?.error && (
              <div className="p-3 text-sm rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
                {state.error}
              </div>
            )}

            {state?.success && (
              <div className="p-3 text-sm rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">
                {state.message}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="staff-name"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wider"
                >
                  Full Name
                </label>
                <input
                  id="staff-name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Tariq Khan"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="staff-email"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wider"
                >
                  Username or Email
                </label>
                <input
                  id="staff-email"
                  name="email"
                  type="text"
                  required
                  placeholder="e.g. tariq or tariq@distribution.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="staff-password"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wider"
                >
                  Initial Password
                </label>
                <input
                  id="staff-password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="staff-role"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wider"
                >
                  Role
                </label>
                <select
                  id="staff-role"
                  name="role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as "STAFF" | "OWNER")}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="STAFF">Staff</option>
                  <option value="OWNER">Owner (Admin)</option>
                </select>
              </div>
            </div>

            {selectedRole === "OWNER" && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>Owner accounts</strong> have full administrative access — products, users, reports, approvals, and settings. Only provision trusted personnel.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg active:scale-[0.98] text-white shadow-xs focus:outline-hidden focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:active:scale-100 cursor-pointer transition-all ${
                  selectedRole === "OWNER"
                    ? "bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
                    : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                }`}
              >
                {isPending && (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {isPending
                  ? "Creating..."
                  : selectedRole === "OWNER"
                  ? "Create Owner Account"
                  : "Create Staff Member"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
