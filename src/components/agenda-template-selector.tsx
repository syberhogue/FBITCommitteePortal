"use client";

import { useMemo, useState } from "react";
import { AgendaItemBuilder } from "@/components/agenda-item-builder";
import { inputClass } from "@/components/ui";
import type { AgendaDraftItem, AgendaPerson } from "@/lib/agenda";

export type AgendaTemplateOption = {
  id: string;
  name: string;
  scope: "Global" | "Committee";
  items: AgendaDraftItem[];
};

export function AgendaTemplateSelector({
  templates,
  people,
}: {
  templates: AgendaTemplateOption[];
  people: AgendaPerson[];
}) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? templates[0],
    [selectedId, templates],
  );

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-slate-600">
        Agenda template
        <select
          value={selected?.id ?? ""}
          className={`${inputClass} mt-1`}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({template.scope})
            </option>
          ))}
        </select>
      </label>
      <AgendaItemBuilder
        key={selected?.id ?? "empty"}
        initialItems={selected?.items ?? []}
        people={people}
      />
    </div>
  );
}
