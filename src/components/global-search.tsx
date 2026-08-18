"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Result = {
  entity_type: string;
  entity_id: string;
  committee_id: string | null;
  title: string;
  subtitle: string;
  rank: number;
};

function hrefFor(result: Result) {
  if (result.entity_type === "person") return "/personnel";
  if (result.entity_type === "role") return "/settings";
  if (result.entity_type === "committee") return `/committees/${result.entity_id}`;
  return `/committees/${result.committee_id}?tab=meetings`;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const timer = window.setTimeout(async () => {
      const id = ++requestId.current;
      const { data } = await createClient().rpc("search_portal", { search_text: query });
      if (id === requestId.current) setResults((data ?? []) as Result[]);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative w-full max-w-xl">
      <Search
        className="pointer-events-none absolute left-3 top-2.5 size-4 text-indigo-200"
        aria-hidden
      />
      <input
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          if (nextQuery.trim().length < 2) setResults([]);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        placeholder="Search people, committees, meetings and actions…"
        aria-label="Search portal"
        className="w-full rounded-lg border border-indigo-500/60 bg-indigo-800/70 py-2 pl-9 pr-9 text-sm text-white placeholder:text-indigo-200 focus:border-white"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setQuery("")}
          className="absolute right-3 top-2.5 text-indigo-200 hover:text-white"
        >
          <X className="size-4" />
        </button>
      )}
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl">
          {results.length ? (
            results.map((result) => (
              <Link
                key={`${result.entity_type}-${result.entity_id}`}
                href={hrefFor(result)}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 hover:bg-indigo-50"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="truncate text-sm font-semibold">{result.title}</span>
                  <span className="text-[10px] font-semibold uppercase text-indigo-600">
                    {result.entity_type}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-500">{result.subtitle}</p>
              </Link>
            ))
          ) : (
            <p className="px-3 py-5 text-center text-sm text-slate-500">
              No permitted results found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
