import { Mail, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageHeader, inputClass } from "@/components/ui";
import { initials } from "@/lib/utils";

export default async function PersonnelPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const [params, supabase] = await Promise.all([searchParams, createClient()]);
  let query = supabase
    .from("profiles")
    .select("id, email, full_name, person_category, global_role, department, title")
    .eq("status", "active")
    .order("full_name");
  if (["faculty", "staff", "admin"].includes(params.category ?? ""))
    query = query.eq("person_category", params.category as "faculty" | "staff" | "admin");
  if (params.q?.trim())
    query = query.or(
      `full_name.ilike.%${params.q.trim()}%,email.ilike.%${params.q.trim()}%,department.ilike.%${params.q.trim()}%`,
    );
  const { data: people = [] } = await query;
  return (
    <>
      <PageHeader
        title="Personnel directory"
        description="Active faculty, staff and administrators across university committees."
      />
      <form className="flex max-w-2xl flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            name="q"
            defaultValue={params.q}
            className={`${inputClass} pl-9`}
            placeholder="Search name, email or department…"
          />
        </div>
        <select
          name="category"
          defaultValue={params.category ?? ""}
          className={`${inputClass} sm:w-40`}
        >
          <option value="">All categories</option>
          <option value="faculty">Faculty</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Filter
        </button>
      </form>
      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          {people?.map((person) => (
            <div key={person.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {initials(person.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{person.full_name}</p>
                <p className="text-sm text-slate-500">
                  {[person.title, person.department].filter(Boolean).join(" · ") ||
                    "No department or title"}
                </p>
              </div>
              <Badge
                tone={
                  person.person_category === "admin"
                    ? "red"
                    : person.person_category === "staff"
                      ? "green"
                      : "indigo"
                }
              >
                {person.person_category}
              </Badge>
              <a
                href={`mailto:${person.email}`}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
              >
                <Mail className="size-4" />
                {person.email}
              </a>
            </div>
          ))}
          {!people?.length && (
            <p className="p-12 text-center text-sm text-slate-500">
              No active personnel match this filter.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
