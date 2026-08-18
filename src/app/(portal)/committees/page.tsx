import Link from "next/link";
import { Archive, CalendarDays, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile, canManageAllCommittees } from "@/lib/auth";
import { Card, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createCommittee } from "../portal-actions";
import { currentTimestamp, formatDate } from "@/lib/utils";

export default async function CommitteesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string }>;
}) {
  const [profile, params, supabase] = await Promise.all([
    requireActiveProfile(),
    searchParams,
    createClient(),
  ]);
  const status = params.status === "archived" ? "archived" : "active";
  let query = supabase
    .from("committees")
    .select("id, name, mandate, status, updated_at")
    .eq("status", status)
    .order("name");
  if (params.q?.trim()) query = query.ilike("name", `%${params.q.trim()}%`);
  const { data: committees = [] } = await query;
  const [membersResult, meetingsResult] = await Promise.all([
    supabase.from("committee_members").select("committee_id"),
    supabase
      .from("meetings")
      .select("committee_id, title, starts_at, status, archived_at")
      .order("starts_at"),
  ]);
  const memberCounts = new Map<string, number>();
  const meetingCounts = new Map<string, number>();
  membersResult.data?.forEach((row) =>
    memberCounts.set(row.committee_id, (memberCounts.get(row.committee_id) ?? 0) + 1),
  );
  meetingsResult.data?.forEach((row) =>
    meetingCounts.set(row.committee_id, (meetingCounts.get(row.committee_id) ?? 0) + 1),
  );
  const nextMeetingByCommittee = new Map<string, { title: string; starts_at: string }>();
  const now = currentTimestamp();
  meetingsResult.data?.forEach((meeting) => {
    if (
      meeting.status === "scheduled" &&
      !meeting.archived_at &&
      new Date(meeting.starts_at).getTime() >= now &&
      !nextMeetingByCommittee.has(meeting.committee_id)
    ) {
      nextMeetingByCommittee.set(meeting.committee_id, meeting);
    }
  });

  return (
    <>
      <PageHeader
        title="Committees"
        description="Browse and manage the committees within your authorized scope."
      />
      {params.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {params.error}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <form className="flex flex-col gap-3 sm:flex-row">
            <input
              name="q"
              defaultValue={params.q}
              className={inputClass}
              placeholder="Filter by committee name…"
            />
            <select name="status" defaultValue={status} className={`${inputClass} sm:w-40`}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
              Filter
            </button>
          </form>
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {committees?.map((committee) => (
              <Card
                key={committee.id}
                className="flex min-h-60 flex-col justify-between p-6 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    {committee.status === "archived" ? (
                      <Archive className="size-5" />
                    ) : (
                      <Users className="size-5" />
                    )}
                  </span>
                  <Link
                    href={`/committees/${committee.id}`}
                    className="mt-4 block text-lg font-bold text-slate-950 hover:text-indigo-700"
                  >
                    {committee.name}
                  </Link>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-500">
                    {committee.mandate || "No mandate recorded."}
                  </p>
                </div>
                <div className="mt-5 flex gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" />
                    {memberCounts.get(committee.id) ?? 0} members
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    {meetingCounts.get(committee.id) ?? 0} meetings
                  </span>
                </div>
                <div className="mt-3 rounded-lg bg-indigo-50 p-3 text-xs">
                  <p className="font-bold uppercase tracking-wide text-[#003C71]">Next meeting</p>
                  {nextMeetingByCommittee.get(committee.id) ? (
                    <p className="mt-1 font-semibold text-slate-700">
                      {nextMeetingByCommittee.get(committee.id)!.title} ·{" "}
                      {formatDate(nextMeetingByCommittee.get(committee.id)!.starts_at, true)}
                    </p>
                  ) : (
                    <p className="mt-1 text-slate-500">Not yet scheduled</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
          {!committees?.length && (
            <Card className="p-12 text-center text-sm text-slate-500">
              No committees match this view.
            </Card>
          )}
        </div>
        {canManageAllCommittees(profile) && (
          <Card className="h-fit p-5 xl:sticky xl:top-36">
            <h2 className="flex items-center gap-2 font-bold">
              <Plus className="size-4 text-indigo-600" /> Create committee
            </h2>
            <form action={createCommittee} className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                Name
                <input name="name" required maxLength={200} className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Mandate
                <textarea
                  name="mandate"
                  rows={5}
                  maxLength={10000}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <SubmitButton className="w-full">Create committee</SubmitButton>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
