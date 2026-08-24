"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { deleteUsers } from "@/app/(portal)/admin/admin-actions";
import { AdminUserRow, type AdminProfile } from "@/components/admin-user-row";
import { secondaryButtonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

type AdminUserListItem = {
  profile: AdminProfile;
  isCurrentUser: boolean;
  lastSignIn: string | null | undefined;
};

export function AdminUserManagement({ users }: { users: AdminUserListItem[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const selectableUsers = useMemo(() => users.filter((user) => !user.isCurrentUser), [users]);
  const selectedUsers = selectableUsers.filter((user) => selectedIds.has(user.profile.id));
  const allSelected =
    selectableUsers.length > 0 && selectableUsers.every((user) => selectedIds.has(user.profile.id));

  function setSelected(id: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (allSelected) return new Set();
      return new Set([...current, ...selectableUsers.map((user) => user.profile.id)]);
    });
  }

  function deleteSelected() {
    if (!selectedUsers.length) return;
    const confirmed = window.confirm(
      `Permanently delete ${selectedUsers.length} selected users? Existing refresh sessions will be revoked.`,
    );
    if (!confirmed) return;

    const formData = new FormData();
    selectedUsers.forEach((user) => formData.append("ids", user.profile.id));
    startTransition(async () => {
      await deleteUsers(formData);
      setSelectedIds(new Set());
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(secondaryButtonClass, "min-h-8 px-2 py-1 text-xs")}
            onClick={toggleAll}
            disabled={!selectableUsers.length || isPending}
          >
            {allSelected ? "Clear visible" : "Select visible"}
          </button>
          <span className="text-xs text-slate-500">{selectedUsers.length} selected</span>
        </div>
        <button
          type="button"
          className="inline-flex min-h-8 items-center justify-center gap-2 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          onClick={deleteSelected}
          disabled={!selectedUsers.length || isPending}
        >
          <Trash2 className="size-3.5" /> Delete selected
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {users.map((user) => (
          <AdminUserRow
            key={user.profile.id}
            profile={user.profile}
            isCurrentUser={user.isCurrentUser}
            lastSignIn={user.lastSignIn}
            selected={selectedIds.has(user.profile.id)}
            onSelectedChange={setSelected}
          />
        ))}
        {!users.length && (
          <div className="p-8 text-center text-sm text-slate-500">
            No users match the current filters.
          </div>
        )}
      </div>
    </>
  );
}
