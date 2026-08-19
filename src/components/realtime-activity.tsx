"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ActivityRow = {
  id: string;
  event_type: string;
  entity_type: string;
  actor_id: string | null;
  committee_id: string | null;
  details: unknown;
  created_at: string;
};

type Details = {
  label?: unknown;
  status?: unknown;
  archived?: unknown;
  completed?: unknown;
};

function details(value: unknown): Details {
  return value && typeof value === "object" ? (value as Details) : {};
}

function actionLabel(event: ActivityRow) {
  const value = details(event.details);
  const operation = event.event_type.split(".").at(-1)?.toLowerCase();
  if (operation === "delete") return "Deleted";

  if (event.entity_type === "meetings") {
    if (value.archived === true) return "Archived";
    if (value.status === "planned") return "Planned";
    if (value.status === "scheduled") return "Scheduled";
    if (value.status === "in_progress") return "Started";
    if (value.status === "completed") return "Completed";
    if (value.status === "cancelled") return "Cancelled";
  }
  if (event.entity_type === "action_items") {
    if (value.completed === true) return "Completed action";
    return operation === "insert" ? "Added action" : "Updated action";
  }
  if (event.entity_type === "goals") {
    if (value.completed === true) return "Completed goal";
    return operation === "insert" ? "Added goal" : "Updated goal";
  }
  if (event.entity_type === "committee_members") {
    return operation === "insert" ? "Assigned member" : "Updated member";
  }
  if (operation === "insert") return "Created";
  if (operation === "update") return "Updated";
  return event.event_type.replaceAll("_", " ").replaceAll(".", " ");
}

function eventTitle(event: ActivityRow) {
  const value = details(event.details).label;
  if (typeof value === "string" && value.trim()) return value;
  return event.entity_type.replaceAll("_", " ");
}

function compactDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

export function RealtimeActivity({
  initial,
  actors,
  allowedCommitteeIds,
  showAll,
}: {
  initial: ActivityRow[];
  actors: { id: string; full_name: string }[];
  allowedCommitteeIds: string[];
  showAll: boolean;
}) {
  const [events, setEvents] = useState(initial);
  const scopeKey = allowedCommitteeIds.join(",");
  const actorNames = useMemo(
    () => new Map(actors.map((actor) => [actor.id, actor.full_name])),
    [actors],
  );

  useEffect(() => {
    const allowed = new Set(scopeKey ? scopeKey.split(",") : []);
    const supabase = createClient();
    const channel = supabase
      .channel("portal-activity")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        (payload) => {
          const incoming = payload.new as ActivityRow;
          if (!showAll && (!incoming.committee_id || !allowed.has(incoming.committee_id))) return;
          setEvents((current) => [incoming, ...current].slice(0, 50));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scopeKey, showAll]);

  return (
    <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-2">
      {events.length ? (
        events.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eef6fb] text-[#003C71]">
              <Activity className="size-4" />
            </span>
            <p className="min-w-0 flex-1 truncate text-slate-700">
              <span className="font-bold">{actionLabel(event)}</span>
              <span aria-hidden="true"> — </span>
              <span>{eventTitle(event)}</span>
              <span aria-hidden="true"> — </span>
              <span>{event.actor_id ? (actorNames.get(event.actor_id) ?? "User") : "System"}</span>
              <span aria-hidden="true"> — </span>
              <time dateTime={event.created_at}>{compactDate(event.created_at)}</time>
            </p>
          </div>
        ))
      ) : (
        <p className="py-8 text-center text-sm text-slate-400">No committee activity yet.</p>
      )}
    </div>
  );
}
