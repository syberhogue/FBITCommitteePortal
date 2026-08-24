"use client";

import { KeyRound, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { Badge, inputClass, secondaryButtonClass } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import {
  deleteUser,
  sendPasswordReset,
  updateUserAccess,
} from "@/app/(portal)/admin/admin-actions";

export type AdminProfile = {
  id: string;
  email: string;
  full_name: string;
  status: "pending" | "active" | "suspended";
  global_role: string;
  person_category: "faculty" | "staff" | "admin";
  department: string | null;
  title: string | null;
};

export function AdminUserRow({
  profile,
  isCurrentUser,
  lastSignIn,
  selected = false,
  onSelectedChange,
}: {
  profile: AdminProfile;
  isCurrentUser: boolean;
  lastSignIn: string | null | undefined;
  selected?: boolean;
  onSelectedChange?: (id: string, selected: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const smallActionClass = "min-h-8 px-2 py-1 text-xs";

  return (
    <div className="px-3 py-2">
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(9rem,1fr)_minmax(12rem,1.2fr)_minmax(8rem,0.8fr)_auto] sm:items-center">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            checked={selected}
            disabled={isCurrentUser || !onSelectedChange}
            onChange={(event) => onSelectedChange?.(profile.id, event.currentTarget.checked)}
            aria-label={`Select ${profile.full_name}`}
          />
          <span className="sr-only">Select {profile.full_name}</span>
        </label>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            {profile.full_name} {isCurrentUser && <Badge tone="indigo">You</Badge>}
          </p>
        </div>
        <p className="truncate text-xs text-slate-600">{profile.email}</p>
        <p className="text-[11px] text-slate-500">Last sign-in {formatDate(lastSignIn, true)}</p>
        <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
          <Badge
            tone={
              profile.status === "active" ? "green" : profile.status === "pending" ? "amber" : "red"
            }
          >
            {profile.status}
          </Badge>
          <form action={sendPasswordReset}>
            <input type="hidden" name="id" value={profile.id} />
            <input type="hidden" name="email" value={profile.email} />
            <button className={cn(secondaryButtonClass, smallActionClass)}>
              <KeyRound className="size-3.5" /> Reset
            </button>
          </form>
          {!isCurrentUser && (
            <form action={deleteUser}>
              <input type="hidden" name="id" value={profile.id} />
              <input type="hidden" name="email" value={profile.email} />
              <ConfirmSubmit
                className={smallActionClass}
                message={`Permanently delete ${profile.email}? Existing refresh sessions will be revoked.`}
              >
                <Trash2 className="size-3.5" /> Delete
              </ConfirmSubmit>
            </form>
          )}
          <button
            type="button"
            className={cn(secondaryButtonClass, smallActionClass)}
            onClick={() => setEditing((value) => !value)}
            aria-expanded={editing}
          >
            {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
            {editing ? "Close" : "Edit"}
          </button>
        </div>
      </div>
      {editing && (
        <form
          action={updateUserAccess}
          className="mt-3 grid gap-2 border-t border-slate-100 pt-3 lg:grid-cols-3"
        >
          <input type="hidden" name="id" value={profile.id} />
          <select name="status" defaultValue={profile.status} className={inputClass}>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <input
            name="global_role"
            defaultValue={profile.global_role}
            className={inputClass}
            list="global-role-options"
            placeholder="Global role"
          />
          <datalist id="global-role-options">
            <option value="Faculty" />
            <option value="AD" />
            <option value="PD-" />
            <option value="GPD-" />
            <option value="Academic Planning Specialist" />
            <option value="DPO" />
            <option value="Program Assistant" />
            <option value="Graduate Program Assistant" />
            <option value="EA-" />
            <option value="Program Coordinator" />
            <option value="Administrative Assistant" />
            <option value="admin" />
            <option value="dean" />
          </datalist>
          <select
            name="person_category"
            defaultValue={profile.person_category}
            className={inputClass}
          >
            <option value="faculty">Faculty category</option>
            <option value="staff">Staff category</option>
            <option value="admin">Admin category</option>
          </select>
          <input
            name="department"
            defaultValue={profile.department ?? ""}
            className={inputClass}
            placeholder="Department"
          />
          <input
            name="title"
            defaultValue={profile.title ?? ""}
            className={inputClass}
            placeholder="Title"
          />
          <SubmitButton className="min-h-10">Save access</SubmitButton>
        </form>
      )}
    </div>
  );
}
