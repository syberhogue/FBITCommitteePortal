import Link from "next/link";
import {
  CalendarCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ListChecks,
  Target,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth";
import { Card, PageHeader, Badge } from "@/components/ui";
import { RealtimeActivity } from "@/components/realtime-activity";
import { currentTimestamp, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const [profile, supabase] = await Promise.all([requireActiveProfile(), createClient()]);
  const [
    profilesResult,
    committeesResult,
    meetingsResult,
    actionsResult,
    goalsResult,
    activityResult,
    membershipsResult,
    rolesResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("committees")
      .select("id, name, mandate, status")
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
      .select("id, event_type, details, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("committee_members").select("committee_id, profile_id, role_id"),
    supabase.from("committee_roles").select("id, access_level"),
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
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your live overview of university committee work, progress and accountability."
      />
      {(plannedForChair.length > 0 || upcomingMeetings.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {plannedForChair.length > 0 && (
            <Card className="border-[#E75D2A] p-5">
              <h2 className="flex items-center gap-2 font-bold text-[#003C71]">
                <ClipboardCheck className="size-5" /> Plans requiring finalization
              </h2>
              <ul className="mt-4 space-y-2">
                {plannedForChair.map((meeting) => (
                  <li key={meeting.id}>
                    <Link
                      href={`/committees/${meeting.committee_id}?tab=meetings&meetingView=finalize`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-orange-50 p-3 hover:bg-orange-100"
                    >
                      <span>
                        <span className="block font-semibold">{meeting.title}</span>
                        <span className="text-xs text-slate-500">
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
          {upcomingMeetings.length > 0 && (
            <Card className="border-[#0077CA] p-5">
              <h2 className="flex items-center gap-2 font-bold text-[#003C71]">
                <CalendarCheck className="size-5" /> Your scheduled meetings
              </h2>
              <ul className="mt-4 space-y-2">
                {upcomingMeetings.slice(0, 5).map((meeting) => (
                  <li key={meeting.id}>
                    <Link
                      href={`/committees/${meeting.committee_id}?tab=meetings`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-indigo-50 p-3 hover:bg-indigo-100"
                    >
                      <span>
                        <span className="block font-semibold">{meeting.title}</span>
                        <span className="text-xs text-slate-500">
                          {committeesById.get(meeting.committee_id)?.name}
                        </span>
                      </span>
                      <span className="text-right text-xs font-semibold text-[#003C71]">
                        {formatDate(meeting.starts_at, true)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-3">
        {[
          {
            label: "Active personnel",
            value: profilesResult.count ?? 0,
            icon: Users,
            color: "bg-blue-100 text-blue-700",
          },
          {
            label: "Visible committees",
            value: committees.length,
            icon: Target,
            color: "bg-indigo-100 text-indigo-700",
          },
          {
            label: "Pending actions",
            value: actions.length,
            icon: ListChecks,
            color: "bg-emerald-100 text-emerald-700",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="flex items-center gap-4 p-6">
            <span className={`grid size-12 place-items-center rounded-xl ${color}`}>
              <Icon className="size-6" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="text-3xl font-bold text-slate-950">{value}</p>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-slate-900">Committee inspector</h2>
              <p className="text-xs text-slate-500">Assigned work and milestones by committee.</p>
            </div>
            <Link
              href="/committees"
              className="text-sm font-semibold text-indigo-600 hover:underline"
            >
              View directory
            </Link>
          </div>
          <div className="space-y-4">
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
                <div key={committee.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div>
                      <Link
                        href={`/committees/${committee.id}`}
                        className="font-bold text-indigo-700 hover:underline"
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
                  <div className="mt-4 border-t border-slate-100 pt-3 text-xs">
                    <span className="font-bold text-[#003C71]">Next meeting: </span>
                    {nextMeeting ? (
                      <Link
                        href={`/committees/${committee.id}?tab=meetings`}
                        className="font-semibold hover:underline"
                      >
                        {nextMeeting.title} · {formatDate(nextMeeting.starts_at, true)}
                      </Link>
                    ) : (
                      <span className="text-slate-400">Not scheduled</span>
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
        <Card className="p-6">
          <h2 className="mb-5 border-b border-slate-100 pb-4 font-bold">Recent activity</h2>
          <RealtimeActivity initial={activityResult.data ?? []} />
        </Card>
      </div>
    </>
  );
}
