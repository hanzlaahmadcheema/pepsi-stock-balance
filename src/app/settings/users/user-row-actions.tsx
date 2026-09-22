"use client";

import { useState } from "react";
import { Role } from "@prisma/client";
import { UserStatusButton } from "./user-status-button";
import { EditUserModal } from "./edit-user-modal";

export function UserRowActions({
  user,
  isCurrentOwner,
  currentUserId,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
  };
  isCurrentOwner: boolean;
  currentUserId: string;
}) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const isSelf = user.id === currentUserId;

  return (
    <>
      <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
        {/* Allow Owners to edit any account */}
        {isCurrentOwner && (
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
          >
            Edit
          </button>
        )}

        <UserStatusButton
          userId={user.id}
          isActive={user.isActive}
          isSelf={isSelf}
          userName={user.name}
        />
      </div>

      {editModalOpen && (
        <EditUserModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          user={user}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
