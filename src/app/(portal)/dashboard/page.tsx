import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminProfile, requireActiveProfile } from "@/lib/auth";
import { Card, Badge } from "@/components/ui";
import { RealtimeActivity } from "@/components/realtime-activity";
import { currentTimestamp, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const [profile, supabase] = await Promise.all([requireActiveProfile(), createClient()]);
  const [
    committeesResult,
    meetingsResult,
    actionsResult,
    goalsResult,
    activityResult,
    membershipsResult,
    rolesResult,
    activityActorsResult,
  ] = await Promise.all([
    supabase
      .from("committees")
      .select("id, name, mandate, status, color")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("meetings")
      .select("id, committee_id, title, starts_at, status, archived_at")
      .order("starts_at"),
    supabase
      .from("action_items")
      .select("id, meeting_id, task, priority, assignee_id, completed")
      .eq("completed", false)
      .order("priority"),
    supabase
      .from("goals")
      .select("id, committee_id, title, target_date, completed")
      .eq("completed", false)
      .order("target_date"),
    supabase
      .from("activity_log")
      .select("id, event_type, entity_type, actor_id, committee_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("committee_members").select("committee_id, profile_id, role_id"),
    supabase.from("committee_roles").select("id, access_level"),
    supabase.from("profiles").select("id, full_name").eq("status", "active"),
  ]);
  const committees = committeesResult.data ?? [];
  const meetings = meetingsResult.data ?? [];
  const actions = actionsResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const now = currentTimestamp();
  const memberships = membershipsResult.data ?? [];
  const rolesById = new Map((rolesResult.data ?? []).map((role) => [role.id, role.access_level]));
  const ownMemberships = memberships.filter((membership) => membership.profile_id === profile.id);
  const ownCommitteeIds = new Set(ownMemberships.map((membership) => membership.committee_id));
  const chairedCommitteeIds = new Set(
    ownMemberships
      .filter((membership) => rolesById.get(membership.role_id) === "chair")
      .map((membership) => membership.committee_id),
  );
  const plannedForChair = meetings.filter(
    (meeting) =>
      meeting.status === "planned" &&
      !meeting.archived_at &&
      chairedCommitteeIds.has(meeting.committee_id),
  );
  const upcomingMeetings = meetings.filter(
    (meeting) =>
      meeting.status === "scheduled" &&
      !meeting.archived_at &&
      ownCommitteeIds.has(meeting.committee_id) &&
      new Date(meeting.starts_at).getTime() >= now,
  );
  const committeesById = new Map(committees.map((committee) => [committee.id, committee]));
  const firstName = profile.full_name.trim().split(/\s+/)[0] || "there";
  const hasMeetingAttention = plannedForChair.length > 0;

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)] xl:items-start">
        <header className="relative h-full overflow-hidden rounded-3xl bg-[#003C71] px-6 py-7 text-white shadow-sm sm:px-8">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-24 size-64 rounded-full border-[44px] border-[#0077CA]/50"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-24 right-32 size-48 rounded-full bg-[#E75D2A]/15"
          />
          <div className="relative flex h-full flex-col justify-between gap-6">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8ED8F8]">
                <Sparkles className="size-4" /> Welcome back, {firstName}
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                Keep up with scheduled meetings, committee priorities and recent work in one place.
              </p>
            </div>
            <Link
              href="/committees"
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#003C71] shadow-sm transition hover:bg-[#EAF6FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              View committees <ArrowRight className="size-4" />
            </Link>
          </div>
        </header>

        <section aria-labelledby="dashboard-meetings-heading">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 id="dashboard-meetings-heading" className="text-xl font-bold text-slate-950">
                Meetings
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Your upcoming schedule and plans waiting for approval.
              </p>
            </div>
            {hasMeetingAttention && (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900">
                <span className="size-2 rounded-full bg-[#E75D2A]" />
                {plannedForChair.length}{" "}
                {plannedForChair.length === 1 ? "plan needs" : "plans need"} attention
              </span>
            )}
          </div>

          <div
            className={`grid gap-5 ${
              upcomingMeetings.length > 0 && plannedForChair.length > 0
                ? "2xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]"
                : ""
            }`}
          >
            {upcomingMeetings.length > 0 ? (
              <Card className="overflow-hidden border-slate-200">
                <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-[#003C71] to-[#005A96] px-5 py-4 text-white sm:px-6">
                  <h3 className="flex items-center gap-3 font-bold">
                    <span className="grid size-9 place-items-center rounded-lg bg-white/15">
                      <CalendarCheck className="size-5" />
                    </span>
                    Your scheduled meetings
                  </h3>
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">
                    {upcomingMeetings.length}
                  </span>
                </div>
                <ul className="max-h-[25rem] space-y-2 overflow-y-auto bg-slate-50/80 p-3 sm:p-4">
                  {upcomingMeetings.map((meeting) => {
                    const committee = committeesById.get(meeting.committee_id);
                    return (
                      <li key={meeting.id}>
                        <Link
                          href={`/committees/${meeting.committee_id}?tab=meetings`}
                          className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#0077CA]/50 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="h-12 w-1 shrink-0 rounded-full"
                              style={{ backgroundColor: committee?.color ?? "#0077CA" }}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-bold text-slate-900 group-hover:text-[#005A96]">
                                {meeting.title}
                              </span>
                              <span className="mt-0.5 block truncate text-sm text-slate-500">
                                {committee?.name}
                              </span>
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-[#003C71]">
                            <CalendarDays className="size-4 text-[#0077CA]" />
                            {formatDate(meeting.starts_at, true)}
                            <ArrowRight className="size-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : (
              <Card className="flex items-center gap-4 border-dashed p-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#EAF6FC] text-[#0077CA]">
                  <CalendarCheck className="size-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">No scheduled meetings</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    New meetings will appear here after their plans are finalized.
                  </p>
                </div>
              </Card>
            )}

            {plannedForChair.length > 0 && (
              <Card className="overflow-hidden border-orange-200">
                <div className="flex items-center justify-between gap-4 border-b border-orange-100 bg-orange-50 px-5 py-4">
                  <h3 className="flex items-center gap-3 font-bold text-[#003C71]">
                    <span className="grid size-9 place-items-center rounded-lg bg-[#E75D2A] text-white">
                      <ClipboardCheck className="size-5" />
                    </span>
                    Plans requiring finalization
                  </h3>
                </div>
                <ul className="max-h-[25rem] space-y-2 overflow-y-auto p-3 sm:p-4">
                  {plannedForChair.map((meeting) => (
                    <li key={meeting.id}>
                      <Link
                        href={`/committees/${meeting.committee_id}?tab=meetings&meetingView=finalize`}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50/60 p-3.5 transition hover:border-orange-300 hover:bg-orange-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900">
                            {meeting.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {committeesById.get(meeting.committee_id)?.name}
                          </span>
                        </span>
                        <Badge tone="orange">Finalize</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Committee inspector</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Assigned work and milestones by committee.
              </p>
            </div>
            <Link
              href="/committees"
              className="inline-flex items-center gap-1 text-sm font-bold text-[#0066A4] hover:underline"
            >
              View directory <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            {committees.map((committee) => {
              const committeeMeetingIds = new Set(
                meetings.filter((m) => m.committee_id === committee.id).map((m) => m.id),
              );
              const committeeActions = actions.filter((action) =>
                committeeMeetingIds.has(action.meeting_id),
              );
              const committeeGoals = goals.filter((goal) => goal.committee_id === committee.id);
              const nextMeeting = meetings
                .filter(
                  (meeting) =>
                    meeting.committee_id === committee.id &&
                    meeting.status === "scheduled" &&
                    !meeting.archived_at &&
                    new Date(meeting.starts_at).getTime() >= now,
                )
                .sort(
                  (left, right) =>
                    new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
                )[0];
              return (
                <div
                  key={committee.id}
                  className="overflow-hidden rounded-xl border border-slate-200"
                  style={{ borderTopColor: committee.color, borderTopWidth: 5 }}
                >
                  <div className="p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                      <div>
                        <Link
                          href={`/committees/${committee.id}`}
                          className="font-bold hover:underline"
                          style={{ color: committee.color }}
                        >
                          {committee.name}
                        </Link>
                        <p className="line-clamp-1 text-xs text-slate-500">{committee.mandate}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge tone="amber">{committeeActions.length} actions</Badge>
                        <Badge tone="green">{committeeGoals.length} goals</Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <ul className="space-y-2">
                        {committeeActions.slice(0, 3).map((action) => (
                          <li key={action.id} className="flex items-center gap-2 text-xs">
                            <Circle className="size-3 text-slate-300" />
                            <span className="flex-1 truncate">{action.task}</span>
                            <Badge
                              tone={
                                action.priority === "high"
                                  ? "red"
                                  : action.priority === "medium"
                                    ? "amber"
                                    : "green"
                              }
                            >
                              {action.priority}
                            </Badge>
                          </li>
                        ))}
                        {!committeeActions.length && (
                          <li className="text-xs italic text-slate-400">No pending actions.</li>
                        )}
                      </ul>
                      <ul className="space-y-2">
                        {committeeGoals.slice(0, 3).map((goal) => (
                          <li key={goal.id} className="flex items-center gap-2 text-xs">
                            <CheckCircle2 className="size-3 text-emerald-500" />
                            <span className="flex-1 truncate">{goal.title}</span>
                            <span className="text-slate-400">{formatDate(goal.target_date)}</span>
                          </li>
                        ))}
                        {!committeeGoals.length && (
                          <li className="text-xs italic text-slate-400">No active goals.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                  <div
                    className="px-4 py-3 text-xs text-white"
                    style={{ backgroundColor: committee.color }}
                  >
                    <span className="font-bold">Next meeting: </span>
                    {nextMeeting ? (
                      <Link
                        href={`/committees/${committee.id}?tab=meetings`}
                        className="font-semibold hover:underline"
                      >
                        {nextMeeting.title} · {formatDate(nextMeeting.starts_at, true)}
                      </Link>
                    ) : (
                      <span className="text-white/75">Not scheduled</span>
                    )}
                  </div>
                </div>
              );
            })}
            {!committees.length && (
              <p className="py-12 text-center text-sm text-slate-500">
                No committees are assigned to your account.
              </p>
            )}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-900">Recent activity</h2>
            <p className="mt-0.5 text-sm text-slate-500">Latest updates from your committees.</p>
          </div>
          <div className="p-5 sm:p-6">
            <RealtimeActivity
              initial={activityResult.data ?? []}
              actors={activityActorsResult.data ?? []}
              allowedCommitteeIds={[...ownCommitteeIds]}
              showAll={isAdminProfile(profile)}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
