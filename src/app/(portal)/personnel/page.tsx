import Link from "next/link";
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
  const [peopleResult, membershipsResult, rolesResult, committeesResult] = await Promise.all([
    query,
    supabase.from("committee_members").select("profile_id, committee_id, role_id"),
    supabase.from("committee_roles").select("id, name, access_level"),
    supabase.from("committees").select("id, name, color").eq("status", "active"),
  ]);
  const people = peopleResult.data ?? [];
  const rolesById = new Map((rolesResult.data ?? []).map((role) => [role.id, role]));
  const committeesById = new Map(
    (committeesResult.data ?? []).map((committee) => [committee.id, committee]),
  );
  const assignmentsByPerson = new Map<
    string,
    { committeeId: string; committeeName: string; roleName: string; accessLevel: string }[]
  >();
  membershipsResult.data?.forEach((membership) => {
    const role = rolesById.get(membership.role_id);
    const committee = committeesById.get(membership.committee_id);
    if (!role || !committee) return;
    const assignments = assignmentsByPerson.get(membership.profile_id) ?? [];
    assignments.push({
      committeeId: committee.id,
      committeeName: committee.name,
      roleName: role.name,
      accessLevel: role.access_level,
    });
    assignmentsByPerson.set(membership.profile_id, assignments);
  });
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
            <div key={person.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                {initials(person.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{person.full_name}</p>
                <p className="truncate text-xs text-slate-500">
                  {[person.title, person.department].filter(Boolean).join(" · ") ||
                    "No department or title"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(assignmentsByPerson.get(person.id) ?? []).map((assignment) => (
                    <Link
                      key={assignment.committeeId}
                      href={`/committees/${assignment.committeeId}`}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold hover:underline ${
                        assignment.accessLevel === "chair"
                          ? "bg-[#003C71] text-white"
                          : assignment.accessLevel === "staff"
                            ? "border border-[#0077CA] bg-[#d9effc] text-[#003C71]"
                            : "bg-[#E75D2A] text-[#00283C]"
                      }`}
                      title={`${assignment.roleName} access`}
                    >
                      {assignment.committeeName} · {assignment.accessLevel}
                    </Link>
                  ))}
                  {!assignmentsByPerson.get(person.id)?.length && (
                    <span className="text-xs italic text-slate-400">No committee assignments</span>
                  )}
                </div>
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
                className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
              >
                <Mail className="size-3.5" />
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
