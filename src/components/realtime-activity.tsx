"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

type ActivityRow = {
  id: string;
  event_type: string;
  details: unknown;
  created_at: string;
};

function label(details: unknown) {
  if (details && typeof details === "object" && "label" in details) {
    return String((details as { label?: unknown }).label ?? "");
  }
  return "";
}

export function RealtimeActivity({ initial }: { initial: ActivityRow[] }) {
  const [events, setEvents] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("portal-activity")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        (payload) => {
          setEvents((current) => [payload.new as ActivityRow, ...current].slice(0, 20));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-4">
      {events.length ? (
        events.map((event) => (
          <div key={event.id} className="flex gap-3 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-600">
              <Activity className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">
                {event.event_type.replaceAll("_", " ")} {label(event.details)}
              </p>
              <p className="text-xs text-slate-400">{formatDate(event.created_at, true)}</p>
            </div>
          </div>
        ))
      ) : (
        <p className="py-8 text-center text-sm text-slate-400">No activity yet.</p>
      )}
    </div>
  );
}
