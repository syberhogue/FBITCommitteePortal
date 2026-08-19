import { Check, Square } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Tables } from "@/types/database";

type AgendaItem = Tables<"meeting_agenda_items">;
type Assignment = Tables<"meeting_agenda_item_assignees">;

export function AgendaItemsView({
  items,
  assignments,
  peopleById,
  compact = false,
}: {
  items: AgendaItem[];
  assignments: Assignment[];
  peopleById: Map<string, { full_name: string }>;
  compact?: boolean;
}) {
  const sortedItems = [...items].sort((left, right) => left.sort_order - right.sort_order);
  return (
    <ol className={`mt-3 space-y-2 ${compact ? "text-xs" : "text-sm"}`}>
      {sortedItems.map((item, index) => {
        const names = assignments
          .filter((assignment) => assignment.agenda_item_id === item.id)
          .map((assignment) => peopleById.get(assignment.profile_id)?.full_name)
          .filter(Boolean);
        return (
          <li
            key={item.id}
            className={`flex items-start gap-2 rounded-lg border p-2.5 ${item.completed_at ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white"}`}
          >
            <span
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${item.completed_at ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-400"}`}
            >
              {item.completed_at ? <Check className="size-3.5" /> : <Square className="size-3" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={item.completed_at ? "line-through" : ""}>
                {index + 1}. {item.title}
                {names.length ? ` (${names.join(", ")})` : ""}
              </span>
              {item.completed_at && (
                <span className="mt-0.5 block text-[11px] text-emerald-700">
                  Checked {formatDate(item.completed_at, true)}
                </span>
              )}
            </span>
          </li>
        );
      })}
      {!sortedItems.length && <li className="italic text-slate-400">No agenda items.</li>}
    </ol>
  );
}
