"use client";

import { useRef, useState, useTransition } from "react";
import { Check, LoaderCircle, Square } from "lucide-react";
import { updateMeeting, setAgendaItemCompletion } from "@/app/(portal)/portal-actions";
import { AgendaItemBuilder } from "@/components/agenda-item-builder";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";
import { SubmitButton } from "@/components/submit-button";
import { inputClass } from "@/components/ui";
import type { AgendaPerson } from "@/lib/agenda";
import type { Tables } from "@/types/database";

type Meeting = Tables<"meetings">;
type AgendaItem = Tables<"meeting_agenda_items">;
type Assignment = Tables<"meeting_agenda_item_assignees">;

function markerTime() {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date());
}

export function MeetingWorkspace({
  meeting,
  committeeId,
  agendaItems,
  assignments,
  people,
}: {
  meeting: Meeting;
  committeeId: string;
  agendaItems: AgendaItem[];
  assignments: Assignment[];
  people: AgendaPerson[];
}) {
  const minutesEditor = useRef<RichTextEditorHandle>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const peopleById = new Map(people.map((person) => [person.id, person.full_name]));
  const sortedItems = [...agendaItems].sort((left, right) => left.sort_order - right.sort_order);
  const draftItems = sortedItems.map((item) => ({
    id: item.id,
    title: item.title,
    assigneeIds: assignments
      .filter((assignment) => assignment.agenda_item_id === item.id)
      .map((assignment) => assignment.profile_id),
  }));

  const toggleItem = (item: AgendaItem, index: number) => {
    const completing = !item.completed_at;
    let minutes = minutesEditor.current?.getSerializedValue() ?? meeting.minutes;
    if (completing) {
      minutes =
        minutesEditor.current?.insertMarkerAtCursor(
          `[Agenda ${index + 1}: ${item.title} — checked at ${markerTime()}]`,
        ) ?? minutes;
    }
    const formData = new FormData();
    formData.set("agenda_item_id", item.id);
    formData.set("committee_id", committeeId);
    formData.set("completed", String(completing));
    formData.set("minutes", minutes);
    setPendingItemId(item.id);
    startTransition(async () => {
      await setAgendaItemCompletion(formData);
      setPendingItemId(null);
    });
  };

  return (
    <form action={updateMeeting} className="space-y-4">
      <input type="hidden" name="id" value={meeting.id} />
      <input type="hidden" name="committee_id" value={committeeId} />
      <input name="title" defaultValue={meeting.title} required className={inputClass} />
      <section className="rounded-xl border border-slate-300 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900">Agenda checklist</h3>
            <p className="text-xs text-slate-500">
              Place the minutes cursor first, then check an item to insert its timestamp marker.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {sortedItems.filter((item) => item.completed_at).length}/{sortedItems.length} complete
          </span>
        </div>
        <ol className="mt-3 space-y-2">
          {sortedItems.map((item, index) => {
            const names = assignments
              .filter((assignment) => assignment.agenda_item_id === item.id)
              .map((assignment) => peopleById.get(assignment.profile_id))
              .filter(Boolean);
            const completed = Boolean(item.completed_at);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={isPending}
                  aria-label={`${completed ? "Uncheck" : "Check"} agenda item ${index + 1}: ${item.title}`}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition ${completed ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white hover:border-[#0077CA]"}`}
                  onClick={() => toggleItem(item, index)}
                >
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${completed ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}
                  >
                    {pendingItemId === item.id ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : completed ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Square className="size-3" />
                    )}
                  </span>
                  <span className={completed ? "line-through" : ""}>
                    {index + 1}. {item.title}
                    {names.length ? ` (${names.join(", ")})` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[#003C71]">
            Edit agenda items and assignments
          </summary>
          <div className="mt-4">
            <AgendaItemBuilder initialItems={draftItems} people={people} />
          </div>
        </details>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <RichTextEditor name="goals" label="Meeting goals" initialValue={meeting.goals} compact />
        <RichTextEditor
          ref={minutesEditor}
          name="minutes"
          label="Minutes"
          initialValue={meeting.minutes}
          compact
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton name="intent" value="save">
          Save meeting notes and agenda
        </SubmitButton>
        <input
          name="template_name"
          className={`${inputClass} sm:w-64`}
          placeholder="Committee template name"
        />
        <SubmitButton name="intent" value="save_template">
          Save agenda as template
        </SubmitButton>
      </div>
    </form>
  );
}
