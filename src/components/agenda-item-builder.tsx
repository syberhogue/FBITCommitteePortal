"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import type { AgendaDraftItem, AgendaPerson } from "@/lib/agenda";

type BuilderItem = AgendaDraftItem & { clientId: string };

export function AgendaItemBuilder({
  initialItems,
  people,
  name = "agenda_items",
}: {
  initialItems: AgendaDraftItem[];
  people: AgendaPerson[];
  name?: string;
}) {
  const [items, setItems] = useState<BuilderItem[]>(() =>
    initialItems.map((item, index) => ({
      ...item,
      clientId: item.id ?? `initial-${index}`,
    })),
  );

  const update = (index: number, changes: Partial<BuilderItem>) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)),
    );
  };

  const move = (index: number, offset: number) => {
    setItems((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(
          items.map(({ id, title, assigneeIds }) => ({ id, title, assigneeIds })),
        )}
      />
      <ol className="space-y-3">
        {items.map((item, index) => {
          const assignedNames = people
            .filter((person) => item.assigneeIds.includes(person.id))
            .map((person) => person.full_name);
          return (
            <li key={item.clientId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 lg:grid-cols-[2rem_minmax(0,1fr)_18rem_auto] lg:items-start">
                <span className="grid size-8 place-items-center rounded-full bg-[#003C71] text-sm font-bold text-white">
                  {index + 1}
                </span>
                <label className="text-xs font-semibold text-slate-600">
                  Agenda item
                  <input
                    value={item.title}
                    aria-label={`Agenda item ${index + 1}`}
                    required
                    maxLength={500}
                    className={`${inputClass} mt-1`}
                    placeholder="Agenda item"
                    onChange={(event) => update(index, { title: event.target.value })}
                  />
                  <span className="mt-1 block font-normal text-slate-500">
                    Preview: {index + 1}. {item.title || "Untitled item"}
                    {assignedNames.length ? ` (${assignedNames.join(", ")})` : ""}
                  </span>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Assigned personnel
                  <select
                    multiple
                    value={item.assigneeIds}
                    className={`${inputClass} mt-1 min-h-24`}
                    aria-label={`Assigned personnel for agenda item ${index + 1}`}
                    onChange={(event) =>
                      update(index, {
                        assigneeIds: Array.from(
                          event.target.selectedOptions,
                          (option) => option.value,
                        ),
                      })
                    }
                  >
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block font-normal text-slate-400">
                    Use Ctrl/Cmd to select multiple names.
                  </span>
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={index === 0}
                    aria-label={`Move agenda item ${index + 1} up`}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={index === items.length - 1}
                    aria-label={`Move agenda item ${index + 1} down`}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 bg-white p-2 text-red-700 hover:bg-red-50"
                    aria-label={`Delete agenda item ${index + 1}`}
                    onClick={() =>
                      setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {!items.length && (
        <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
          No agenda items. Add one before saving.
        </p>
      )}
      <button
        type="button"
        className={secondaryButtonClass}
        onClick={() =>
          setItems((current) => [
            ...current,
            { clientId: crypto.randomUUID(), title: "", assigneeIds: [] },
          ])
        }
      >
        <Plus className="size-4" /> Add agenda item
      </button>
    </div>
  );
}
