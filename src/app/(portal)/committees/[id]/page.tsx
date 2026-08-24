import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CalendarPlus,
  CircleDot,
  ClipboardCheck,
  ExternalLink,
  FolderPlus,
  History as HistoryIcon,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile, canManageAllCommittees } from "@/lib/auth";
import { Badge, Card, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MeetingCard } from "@/components/meeting-card";
import { MeetingFocus } from "@/components/meeting-focus";
import { CommitteeColorPicker } from "@/components/committee-color-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { AgendaItemBuilder } from "@/components/agenda-item-builder";
import {
  AgendaTemplateSelector,
  type AgendaTemplateOption,
} from "@/components/agenda-template-selector";
import { currentTimestamp, formatDate } from "@/lib/utils";
import {
  addMember,
  createGoal,
  createMeetingPlan,
  createResourceGroup,
  createResourceLink,
  deleteGoal,
  deleteResourceGroup,
  deleteResourceLink,
  moveResource,
  removeMember,
  saveExpectation,
  setCommitteeStatus,
  toggleGoal,
  updateCommittee,
  updateCommitteeColor,
  updateMemberRole,
} from "../../portal-actions";

const tabs = ["meetings", "goals", "expectations", "members", "resources"] as const;
type Tab = (typeof tabs)[number];
const meetingViews = ["upcoming", "in-progress", "plan", "finalize", "history"] as const;
type MeetingView = (typeof meetingViews)[number];

export default async function CommitteeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; meetingView?: string; focus?: string; error?: string }>;
}) {
  const [{ id }, query, profile, supabase] = await Promise.all([
    params,
    searchParams,
    requireActiveProfile(),
    createClient(),
  ]);
  const tab: Tab = tabs.includes(query.tab as Tab) ? (query.tab as Tab) : "meetings";
  const meetingView: MeetingView = meetingViews.includes(query.meetingView as MeetingView)
    ? (query.meetingView as MeetingView)
    : "upcoming";
  const { data: committee } = await supabase.from("committees").select("*").eq("id", id).single();
  if (!committee) notFound();

  const [
    rolesResult,
    peopleResult,
    membershipsResult,
    meetingsResult,
    actionsResult,
    goalsResult,
    expectationsResult,
    groupsResult,
    linksResult,
    templatesResult,
    templateItemsResult,
    templateAssignmentsResult,
    attendanceResult,
    meetingAgendaItemsResult,
    meetingAgendaAssignmentsResult,
  ] = await Promise.all([
    supabase.from("committee_roles").select("*").order("sort_order"),
    supabase
      .from("profiles")
      .select("id, full_name, email, person_category, department, title")
      .eq("status", "active")
      .order("full_name"),
    supabase.from("committee_members").select("*").eq("committee_id", id),
    supabase
      .from("meetings")
      .select("*")
      .eq("committee_id", id)
      .order("starts_at", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("action_items").select("*").order("created_at"),
    supabase.from("goals").select("*").eq("committee_id", id).order("target_date"),
    supabase.from("role_expectations").select("*").eq("committee_id", id),
    supabase.from("resource_groups").select("*").eq("committee_id", id).order("sort_order"),
    supabase.from("resource_links").select("*").order("sort_order"),
    supabase
      .from("agenda_templates")
      .select("*")
      .or(`committee_id.is.null,committee_id.eq.${id}`)
      .order("committee_id", { nullsFirst: true })
      .order("name"),
    supabase.from("agenda_template_items").select("*").order("sort_order"),
    supabase.from("agenda_template_item_assignees").select("*"),
    supabase.from("meeting_attendance").select("*"),
    supabase.from("meeting_agenda_items").select("*").order("sort_order"),
    supabase.from("meeting_agenda_item_assignees").select("*"),
  ]);
  const roles = rolesResult.data ?? [];
  const people = peopleResult.data ?? [];
  const memberships = membershipsResult.data ?? [];
  const meetings = meetingsResult.data ?? [];
  const meetingIds = new Set(meetings.map((meeting) => meeting.id));
  const actions = (actionsResult.data ?? []).filter((action) => meetingIds.has(action.meeting_id));
  const goals = goalsResult.data ?? [];
  const expectations = expectationsResult.data ?? [];
  const groups = groupsResult.data ?? [];
  const groupIds = new Set(groups.map((group) => group.id));
  const links = (linksResult.data ?? []).filter((link) => groupIds.has(link.group_id));
  const attendance = (attendanceResult.data ?? []).filter((record) =>
    meetingIds.has(record.meeting_id),
  );
  const meetingAgendaItems = (meetingAgendaItemsResult.data ?? []).filter((item) =>
    meetingIds.has(item.meeting_id),
  );
  const agendaItemIds = new Set(meetingAgendaItems.map((item) => item.id));
  const meetingAgendaAssignments = (meetingAgendaAssignmentsResult.data ?? []).filter(
    (assignment) => agendaItemIds.has(assignment.agenda_item_id),
  );
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const ownMembership = memberships.find((membership) => membership.profile_id === profile.id);
  const ownAccess = ownMembership ? rolesById.get(ownMembership.role_id)?.access_level : undefined;
  const managesAll = canManageAllCommittees(profile);
  const canManageRoster = managesAll || ownAccess === "chair";
  const canEditContent = managesAll || ownAccess === "chair" || ownAccess === "staff";
  const canPlanMeetings = ownAccess === "chair" || ownAccess === "staff";
  const canFinalizeMeetings = ownAccess === "chair";
  const canUnlockMeetings = profile.global_role === "admin" || ownAccess === "staff";
  const canArchiveMeetings = managesAll || canPlanMeetings;
  const canDeleteMeetings = profile.global_role === "admin";
  const canEditHeader = managesAll || ownAccess === "chair";
  const canChooseColor =
    profile.global_role === "admin" || ownAccess === "chair" || ownAccess === "staff";
  const canEditCommitteeInfo = canEditHeader || canChooseColor;
  const assignedIds = new Set(memberships.map((membership) => membership.profile_id));
  const availablePeople = people.filter((person) => !assignedIds.has(person.id));
  const templates = templatesResult.data ?? [];
  const templateItems = templateItemsResult.data ?? [];
  const templateAssignments = templateAssignmentsResult.data ?? [];
  const templateOptions: AgendaTemplateOption[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    scope: template.committee_id ? "Committee" : "Global",
    items: templateItems
      .filter((item) => item.template_id === template.id)
      .map((item) => ({
        id: item.id,
        title: item.title,
        assigneeIds: templateAssignments
          .filter((assignment) => assignment.agenda_item_id === item.id)
          .map((assignment) => assignment.profile_id),
      })),
  }));
  const agendaItemsFor = (meetingId: string) =>
    meetingAgendaItems.filter((item) => item.meeting_id === meetingId);
  const agendaAssignmentsFor = (meetingId: string) => {
    const ids = new Set(agendaItemsFor(meetingId).map((item) => item.id));
    return meetingAgendaAssignments.filter((assignment) => ids.has(assignment.agenda_item_id));
  };
  const now = currentTimestamp();
  const activeMeetings = meetings.filter((meeting) => !meeting.archived_at);
  const plannedMeetings = activeMeetings.filter((meeting) => meeting.status === "planned");
  const upcomingMeetings = activeMeetings
    .filter((meeting) => meeting.status === "scheduled")
    .sort(
      (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    );
  const inProgressMeetings = activeMeetings
    .filter((meeting) => meeting.status === "in_progress")
    .sort(
      (left, right) =>
        new Date(right.started_at ?? right.starts_at).getTime() -
        new Date(left.started_at ?? left.starts_at).getTime(),
    );
  const nextMeeting = upcomingMeetings.find(
    (meeting) => meeting.status === "scheduled" && new Date(meeting.starts_at).getTime() >= now,
  );
  const otherUpcomingMeetings = upcomingMeetings.filter(
    (meeting) => meeting.id !== nextMeeting?.id,
  );
  const historyMeetings = meetings.filter(
    (meeting) =>
      Boolean(meeting.archived_at) ||
      meeting.status === "completed" ||
      meeting.status === "cancelled",
  );
  const pastMeetingIds = new Set(
    meetings
      .filter((meeting) => new Date(meeting.starts_at).getTime() < now)
      .map((meeting) => meeting.id),
  );
  const outstandingPastActions = actions.filter(
    (action) => !action.completed && pastMeetingIds.has(action.meeting_id),
  );
  const meetingsById = new Map(meetings.map((meeting) => [meeting.id, meeting]));

  return (
    <>
      <div>
        <Link href="/committees" className="text-sm font-semibold text-indigo-600 hover:underline">
          ← Committees
        </Link>
      </div>
      <Card
        className="overflow-hidden"
        style={{ borderTopColor: committee.color, borderTopWidth: 6 }}
      >
        <div className="p-5" style={{ backgroundColor: `${committee.color}12` }}>
          {canEditCommitteeInfo ? (
            <details className="group">
              <summary className="list-none [&::-webkit-details-marker]:hidden">
                <div className="flex cursor-pointer flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1
                        className="text-2xl font-bold tracking-tight sm:text-3xl"
                        style={{ color: committee.color }}
                      >
                        {committee.name}
                      </h1>
                      {committee.short_name && <Badge tone="slate">{committee.short_name}</Badge>}
                      <Badge tone={committee.status === "active" ? "green" : "slate"}>
                        {committee.status}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 max-w-5xl text-sm text-slate-700">
                      {committee.mandate || "No committee mandate has been recorded."}
                    </p>
                  </div>
                  <span className={secondaryButtonClass}>
                    <Pencil className="size-4" />
                    <span className="group-open:hidden">Edit</span>
                    <span className="hidden group-open:inline">Close</span>
                  </span>
                </div>
              </summary>
              <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                {canEditHeader && (
                  <form action={updateCommittee} className="space-y-3">
                    <input type="hidden" name="id" value={id} />
                    <input
                      name="name"
                      defaultValue={committee.name}
                      required
                      className="w-full border-0 bg-transparent p-0 text-2xl font-bold tracking-tight focus:ring-0"
                      style={{ color: committee.color }}
                    />
                    <input
                      name="short_name"
                      defaultValue={committee.short_name}
                      required
                      maxLength={40}
                      className={`${inputClass} uppercase`}
                      placeholder="Committee acronym"
                    />
                    <textarea
                      name="mandate"
                      defaultValue={committee.mandate}
                      rows={3}
                      className={inputClass}
                      placeholder="Committee mandate"
                    />
                    <SubmitButton>Save committee</SubmitButton>
                  </form>
                )}
                {canChooseColor && (
                  <form
                    action={updateCommitteeColor}
                    className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white/70 p-3"
                  >
                    <input type="hidden" name="id" value={id} />
                    <CommitteeColorPicker defaultValue={committee.color} compact />
                    <SubmitButton>Apply colour</SubmitButton>
                  </form>
                )}
              </div>
            </details>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1
                  className="text-2xl font-bold tracking-tight sm:text-3xl"
                  style={{ color: committee.color }}
                >
                  {committee.name}
                </h1>
                {committee.short_name && <Badge tone="slate">{committee.short_name}</Badge>}
                <Badge tone={committee.status === "active" ? "green" : "slate"}>
                  {committee.status}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 max-w-5xl text-sm text-slate-700">
                {committee.mandate || "No committee mandate has been recorded."}
              </p>
            </div>
          )}
        </div>
      </Card>
      {query.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {query.error}
        </p>
      )}
      <nav
        className="flex gap-1 overflow-x-auto border-b border-slate-200"
        aria-label="Committee sections"
      >
        {tabs.map((item) => (
          <Link
            key={item}
            href={`/committees/${id}?tab=${item}`}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold capitalize ${tab === item ? "font-bold" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            style={
              tab === item ? { borderColor: committee.color, color: committee.color } : undefined
            }
          >
            {item}
          </Link>
        ))}
      </nav>

      {tab === "members" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-300 bg-slate-800 p-5 text-white">
              <h2 className="font-bold">Committee roster</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {memberships.map((membership, membershipIndex) => {
                const person = peopleById.get(membership.profile_id);
                const role = rolesById.get(membership.role_id);
                return (
                  <div
                    key={membership.id}
                    className={`flex flex-col gap-3 p-5 sm:flex-row sm:items-center ${membershipIndex % 2 === 0 ? "bg-white" : "bg-slate-100"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{person?.full_name ?? "Unknown user"}</p>
                      <p className="text-xs text-slate-500">
                        {person?.email} · {person?.person_category}
                      </p>
                    </div>
                    {canManageRoster ? (
                      <form action={updateMemberRole} className="flex gap-2">
                        <input type="hidden" name="id" value={membership.id} />
                        <input type="hidden" name="committee_id" value={id} />
                        <select
                          name="role_id"
                          defaultValue={membership.role_id}
                          className={inputClass}
                        >
                          {roles.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name} ({option.access_level})
                            </option>
                          ))}
                        </select>
                        <SubmitButton>Update</SubmitButton>
                      </form>
                    ) : (
                      <Badge tone="indigo">{role?.name ?? "Member"}</Badge>
                    )}
                    {canManageRoster && (
                      <form action={removeMember}>
                        <input type="hidden" name="id" value={membership.id} />
                        <input type="hidden" name="committee_id" value={id} />
                        <ConfirmSubmit
                          message={`Remove ${person?.full_name ?? "this member"} from the committee?`}
                          className="p-2"
                        >
                          <Trash2 className="size-4" />
                        </ConfirmSubmit>
                      </form>
                    )}
                  </div>
                );
              })}
              {!memberships.length && (
                <p className="p-10 text-center text-sm text-slate-500">No members assigned.</p>
              )}
            </div>
          </Card>
          {canManageRoster && (
            <Card className="h-fit p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <UserPlus className="size-4 text-indigo-600" /> Assign member
              </h2>
              {availablePeople.length ? (
                <form action={addMember} className="mt-4 space-y-3">
                  <input type="hidden" name="committee_id" value={id} />
                  <select name="profile_id" className={inputClass}>
                    {availablePeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name} — {person.email}
                      </option>
                    ))}
                  </select>
                  <select name="role_id" className={inputClass}>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name} ({role.access_level})
                      </option>
                    ))}
                  </select>
                  <SubmitButton className="w-full">Assign</SubmitButton>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Every active person is already assigned.
                </p>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === "meetings" && (
        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-24">
            <nav className="grid gap-1" aria-label="Meeting views">
              {[
                {
                  value: "upcoming" as const,
                  label: "Upcoming",
                  icon: CalendarDays,
                  count: upcomingMeetings.length,
                  restricted: false,
                },
                {
                  value: "in-progress" as const,
                  label: "In Progress",
                  icon: CircleDot,
                  count: inProgressMeetings.length,
                  restricted: false,
                },
                {
                  value: "plan" as const,
                  label: "Plan",
                  icon: CalendarPlus,
                  count: 0,
                  restricted: !canPlanMeetings,
                },
                {
                  value: "finalize" as const,
                  label: "Finalize",
                  icon: ClipboardCheck,
                  count: plannedMeetings.length,
                  restricted: !canFinalizeMeetings,
                },
                {
                  value: "history" as const,
                  label: "History",
                  icon: HistoryIcon,
                  count: historyMeetings.length,
                  restricted: false,
                },
              ].map((item) => {
                const Icon = item.icon;
                const selected = meetingView === item.value;
                return (
                  <Link
                    key={item.value}
                    href={`/committees/${id}?tab=meetings&meetingView=${item.value}`}
                    aria-current={selected ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                      selected
                        ? "text-white"
                        : item.restricted
                          ? "bg-slate-100 text-slate-400 hover:bg-slate-200"
                          : "text-slate-700 hover:bg-[#eef6fb] hover:text-[#003C71]"
                    }`}
                    style={selected ? { backgroundColor: committee.color } : undefined}
                  >
                    <Icon className="size-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.count > 0 && (
                      <span
                        className={`grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-xs ${
                          selected ? "bg-white text-[#003C71]" : "bg-[#E75D2A] text-[#00283C]"
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                    {item.restricted && item.count === 0 && <LockKeyhole className="size-3.5" />}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 space-y-6">
            {meetingView === "upcoming" && (
              <>
                <div>
                  <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-[#003C71]">
                    <CalendarDays className="size-5" /> Next Meeting
                  </h2>
                  <p className="mb-4 text-sm text-slate-500">
                    Scheduled meetings are folded until you choose to inspect their plans.
                  </p>
                  {nextMeeting ? (
                    <MeetingCard
                      meeting={nextMeeting}
                      actions={actions.filter((action) => action.meeting_id === nextMeeting.id)}
                      attendance={attendance.filter(
                        (record) => record.meeting_id === nextMeeting.id,
                      )}
                      agendaItems={agendaItemsFor(nextMeeting.id)}
                      agendaAssignments={agendaAssignmentsFor(nextMeeting.id)}
                      committeeId={id}
                      memberships={memberships}
                      people={people}
                      canPlan={canPlanMeetings}
                      canFinalize={false}
                      canUnlock={canUnlockMeetings}
                      canArchive={canArchiveMeetings}
                      canDelete={canDeleteMeetings}
                      meetingView="upcoming"
                      upcomingTone="next"
                      activeMeeting={inProgressMeetings[0] ?? null}
                    />
                  ) : (
                    <Card className="border-dashed p-6 text-sm text-slate-500">
                      No finalized future meeting is currently scheduled.
                    </Card>
                  )}
                </div>

                {otherUpcomingMeetings.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-lg font-bold text-[#003C71]">Other upcoming meetings</h2>
                    {otherUpcomingMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        actions={actions.filter((action) => action.meeting_id === meeting.id)}
                        attendance={attendance.filter((record) => record.meeting_id === meeting.id)}
                        agendaItems={agendaItemsFor(meeting.id)}
                        agendaAssignments={agendaAssignmentsFor(meeting.id)}
                        committeeId={id}
                        memberships={memberships}
                        people={people}
                        canPlan={canPlanMeetings}
                        canFinalize={false}
                        canUnlock={canUnlockMeetings}
                        canArchive={canArchiveMeetings}
                        canDelete={canDeleteMeetings}
                        meetingView="upcoming"
                        upcomingTone="other"
                        activeMeeting={inProgressMeetings[0] ?? null}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {meetingView === "in-progress" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#E75D2A] bg-orange-50 p-5">
                  <h2 className="flex items-center gap-2 text-xl font-bold text-[#003C71]">
                    <CircleDot className="size-5 text-[#E75D2A]" /> Meetings in progress
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Active meetings appear here for attendance, notes, minutes, and action-item
                    work.
                  </p>
                </div>
                {inProgressMeetings.map((meeting) => {
                  const focused = query.focus === meeting.id;
                  return (
                    <div
                      key={meeting.id}
                      id={`meeting-${meeting.id}`}
                      tabIndex={-1}
                      className="scroll-mt-28 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#E75D2A]/30"
                    >
                      {focused && <MeetingFocus meetingId={meeting.id} />}
                      <MeetingCard
                        meeting={meeting}
                        actions={actions.filter((action) => action.meeting_id === meeting.id)}
                        attendance={attendance.filter((record) => record.meeting_id === meeting.id)}
                        agendaItems={agendaItemsFor(meeting.id)}
                        agendaAssignments={agendaAssignmentsFor(meeting.id)}
                        committeeId={id}
                        memberships={memberships}
                        people={people}
                        canPlan={canPlanMeetings}
                        canFinalize={false}
                        canUnlock={canUnlockMeetings}
                        canArchive={canArchiveMeetings}
                        canDelete={canDeleteMeetings}
                        meetingView="in-progress"
                      />
                    </div>
                  );
                })}
                {!inProgressMeetings.length && (
                  <Card className="border-dashed p-8 text-center text-sm text-slate-500">
                    No meetings are currently in progress.
                  </Card>
                )}
              </div>
            )}

            {meetingView === "plan" && (
              <Card
                className={`p-6 ${canPlanMeetings ? "border-[#0077CA]" : "border-slate-300 bg-slate-200 text-slate-500"}`}
              >
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <CalendarPlus className="size-5" /> Plan a meeting
                </h2>
                {canPlanMeetings ? (
                  <>
                    <p className="mt-1 text-sm text-slate-500">
                      Submit a proposed time, agenda, and goals for Chair review.
                    </p>
                    <form action={createMeetingPlan} className="mt-5 space-y-4">
                      <input type="hidden" name="committee_id" value={id} />
                      <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
                        <input
                          name="title"
                          required
                          className={inputClass}
                          placeholder="Meeting title"
                        />
                        <input
                          name="starts_at"
                          type="datetime-local"
                          required
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <h3 className="mb-2 text-sm font-bold text-slate-800">Agenda items</h3>
                        <AgendaTemplateSelector templates={templateOptions} people={people} />
                      </div>
                      <RichTextEditor name="goals" label="Meeting goals" initialValue="" />
                      <SubmitButton>Submit plan for Chair</SubmitButton>
                    </form>
                  </>
                ) : (
                  <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-300/60 p-4">
                    <LockKeyhole className="mt-0.5 size-5 shrink-0" />
                    <p className="text-sm font-medium">
                      Planning is unavailable for your committee role. Only committee Chairs and
                      Staff can submit a meeting plan.
                    </p>
                  </div>
                )}
              </Card>
            )}

            {meetingView === "finalize" && (
              <div className="space-y-4">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-[#003C71]">
                    <ClipboardCheck className="size-5" /> Finalize meeting plans
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Plans submitted for Chair review appear here until they are finalized.
                  </p>
                </div>
                {!canFinalizeMeetings && (
                  <div className="flex items-center gap-2 rounded-xl bg-slate-200 p-3 text-sm font-semibold text-slate-500">
                    <LockKeyhole className="size-4" /> These plans are read-only because only the
                    committee Chair can finalize them.
                  </div>
                )}
                {plannedMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    actions={[]}
                    attendance={[]}
                    agendaItems={agendaItemsFor(meeting.id)}
                    agendaAssignments={agendaAssignmentsFor(meeting.id)}
                    committeeId={id}
                    memberships={memberships}
                    people={people}
                    canPlan={canFinalizeMeetings}
                    canFinalize={canFinalizeMeetings}
                    canUnlock={false}
                    canArchive={canArchiveMeetings}
                    canDelete={canDeleteMeetings}
                    meetingView="finalize"
                  />
                ))}
                {!plannedMeetings.length && (
                  <Card className="border-dashed p-8 text-center text-sm text-slate-500">
                    No meeting plans require finalization.
                  </Card>
                )}
              </div>
            )}

            {meetingView === "history" && (
              <div className="space-y-4">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-[#003C71]">
                    <HistoryIcon className="size-5" /> Meeting history
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Completed, cancelled, and archived meetings are folded for quick scanning.
                  </p>
                </div>
                {ownAccess === "chair" && outstandingPastActions.length > 0 && (
                  <Card className="border-amber-200 bg-amber-50/40 p-5">
                    <h3 className="font-bold text-amber-900">
                      Outstanding actions from past meetings
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {outstandingPastActions.map((action) => (
                        <li key={action.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge tone={action.priority === "high" ? "red" : "orange"}>
                            {action.priority}
                          </Badge>
                          <span className="font-medium">{action.task}</span>
                          <span className="text-xs text-slate-500">
                            {meetingsById.get(action.meeting_id)?.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                {historyMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    actions={actions.filter((action) => action.meeting_id === meeting.id)}
                    attendance={attendance.filter((record) => record.meeting_id === meeting.id)}
                    agendaItems={agendaItemsFor(meeting.id)}
                    agendaAssignments={agendaAssignmentsFor(meeting.id)}
                    committeeId={id}
                    memberships={memberships}
                    people={people}
                    canPlan={false}
                    canFinalize={false}
                    canUnlock={canUnlockMeetings}
                    canArchive={canArchiveMeetings}
                    canDelete={canDeleteMeetings}
                    meetingView="history"
                  />
                ))}
                {!historyMeetings.length && (
                  <Card className="border-dashed p-8 text-center text-sm text-slate-500">
                    No completed or archived meetings yet.
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "goals" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <Card
            className={`divide-y ${canEditContent ? "divide-slate-100" : "divide-slate-300 bg-slate-100"}`}
          >
            {goals.map((goal) => (
              <div
                key={goal.id}
                className={`flex items-center gap-3 p-5 ${canEditContent ? "bg-white" : "bg-slate-100 text-slate-700"}`}
              >
                {canEditContent ? (
                  <form action={toggleGoal}>
                    <input type="hidden" name="id" value={goal.id} />
                    <input type="hidden" name="committee_id" value={id} />
                    <input type="hidden" name="completed" value={String(!goal.completed)} />
                    <button
                      aria-label="Toggle goal"
                      className={`size-5 rounded border-2 ${goal.completed ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`}
                    />
                  </form>
                ) : (
                  <span
                    aria-hidden="true"
                    className={`size-5 rounded border-2 ${goal.completed ? "border-emerald-500 bg-emerald-500" : "border-slate-400 bg-slate-200"}`}
                  />
                )}
                <div className="flex-1">
                  <p className={goal.completed ? "text-slate-400 line-through" : "font-medium"}>
                    {goal.title}
                  </p>
                  <p className="text-xs text-slate-500">Target: {formatDate(goal.target_date)}</p>
                </div>
                {canEditContent && (
                  <form action={deleteGoal}>
                    <input type="hidden" name="id" value={goal.id} />
                    <input type="hidden" name="committee_id" value={id} />
                    <ConfirmSubmit message="Delete this goal?" className="p-2">
                      <Trash2 className="size-4" />
                    </ConfirmSubmit>
                  </form>
                )}
              </div>
            ))}
            {!goals.length && (
              <p className="p-12 text-center text-sm text-slate-500">No goals defined.</p>
            )}
          </Card>
          {canEditContent && (
            <Card className="h-fit p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <Plus className="size-4 text-indigo-600" /> Add goal
              </h2>
              <form action={createGoal} className="mt-4 space-y-3">
                <input type="hidden" name="committee_id" value={id} />
                <textarea
                  name="title"
                  required
                  className={inputClass}
                  placeholder="Goal description"
                />
                <input name="target_date" type="date" className={inputClass} />
                <SubmitButton className="w-full">Add goal</SubmitButton>
              </form>
            </Card>
          )}
        </div>
      )}

      {tab === "expectations" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {roles.map((role) => {
            const expectation = expectations.find((item) => item.role_id === role.id);
            return (
              <Card key={role.id} className={`p-5 ${canManageRoster ? "" : "bg-slate-100"}`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold">{role.name}</h2>
                  <Badge tone="indigo">{role.access_level}</Badge>
                </div>
                {canManageRoster ? (
                  <form action={saveExpectation} className="mt-4">
                    <input type="hidden" name="committee_id" value={id} />
                    <input type="hidden" name="role_id" value={role.id} />
                    <textarea
                      name="expectation_text"
                      defaultValue={expectation?.expectation_text ?? ""}
                      rows={6}
                      className={inputClass}
                      placeholder="Define responsibilities and operating expectations…"
                    />
                    <SubmitButton className="mt-3">Save expectation</SubmitButton>
                  </form>
                ) : (
                  <div className="mt-4 min-h-36 whitespace-pre-wrap rounded-xl border border-slate-300 bg-slate-200 p-4 text-sm text-slate-700">
                    {expectation?.expectation_text || "No expectations have been recorded."}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "resources" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-5">
            {groups.map((group, groupIndex) => {
              const groupLinks = links.filter((link) => link.group_id === group.id);
              return (
                <Card key={group.id} className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <details className="flex-1" open>
                      <summary className="cursor-pointer font-bold">
                        {group.name}{" "}
                        <span className="font-normal text-slate-400">({groupLinks.length})</span>
                      </summary>
                      <div className="mt-3 divide-y divide-slate-100 bg-white">
                        {groupLinks.map((link, linkIndex) => (
                          <div key={link.id} className="flex items-center gap-2 py-3">
                            <div className="min-w-0 flex-1">
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 font-semibold text-indigo-600 hover:underline"
                              >
                                {link.title}
                                <ExternalLink className="size-3" />
                              </a>
                              <p className="text-xs text-slate-500">{link.description}</p>
                            </div>
                            {canEditContent && (
                              <>
                                <form action={moveResource}>
                                  <input type="hidden" name="entity" value="link" />
                                  <input type="hidden" name="id" value={link.id} />
                                  <input type="hidden" name="parent_id" value={group.id} />
                                  <input type="hidden" name="committee_id" value={id} />
                                  <input type="hidden" name="direction" value="up" />
                                  <button
                                    disabled={linkIndex === 0}
                                    className={secondaryButtonClass}
                                  >
                                    <ArrowUp className="size-3" />
                                  </button>
                                </form>
                                <form action={moveResource}>
                                  <input type="hidden" name="entity" value="link" />
                                  <input type="hidden" name="id" value={link.id} />
                                  <input type="hidden" name="parent_id" value={group.id} />
                                  <input type="hidden" name="committee_id" value={id} />
                                  <input type="hidden" name="direction" value="down" />
                                  <button
                                    disabled={linkIndex === groupLinks.length - 1}
                                    className={secondaryButtonClass}
                                  >
                                    <ArrowDown className="size-3" />
                                  </button>
                                </form>
                                <form action={deleteResourceLink}>
                                  <input type="hidden" name="id" value={link.id} />
                                  <input type="hidden" name="committee_id" value={id} />
                                  <ConfirmSubmit message="Delete this link?" className="p-2">
                                    <Trash2 className="size-3.5" />
                                  </ConfirmSubmit>
                                </form>
                              </>
                            )}
                          </div>
                        ))}
                        {!groupLinks.length && (
                          <p className="py-5 text-center text-xs text-slate-400">
                            No links in this group.
                          </p>
                        )}
                        {canEditContent && (
                          <form
                            action={createResourceLink}
                            className="grid gap-2 py-4 md:grid-cols-2"
                          >
                            <input type="hidden" name="committee_id" value={id} />
                            <input type="hidden" name="group_id" value={group.id} />
                            <input
                              name="title"
                              required
                              className={inputClass}
                              placeholder="Link title"
                            />
                            <input
                              name="url"
                              type="url"
                              required
                              className={inputClass}
                              placeholder="https://…"
                            />
                            <input
                              name="description"
                              className={`${inputClass} md:col-span-2`}
                              placeholder="Description (optional)"
                            />
                            <SubmitButton className="md:col-span-2">Add link</SubmitButton>
                          </form>
                        )}
                      </div>
                    </details>
                    {canEditContent && (
                      <div className="flex gap-1">
                        <form action={moveResource}>
                          <input type="hidden" name="entity" value="group" />
                          <input type="hidden" name="id" value={group.id} />
                          <input type="hidden" name="parent_id" value={id} />
                          <input type="hidden" name="committee_id" value={id} />
                          <input type="hidden" name="direction" value="up" />
                          <button disabled={groupIndex === 0} className={secondaryButtonClass}>
                            <ArrowUp className="size-3" />
                          </button>
                        </form>
                        <form action={moveResource}>
                          <input type="hidden" name="entity" value="group" />
                          <input type="hidden" name="id" value={group.id} />
                          <input type="hidden" name="parent_id" value={id} />
                          <input type="hidden" name="committee_id" value={id} />
                          <input type="hidden" name="direction" value="down" />
                          <button
                            disabled={groupIndex === groups.length - 1}
                            className={secondaryButtonClass}
                          >
                            <ArrowDown className="size-3" />
                          </button>
                        </form>
                        <form action={deleteResourceGroup}>
                          <input type="hidden" name="id" value={group.id} />
                          <input type="hidden" name="committee_id" value={id} />
                          <ConfirmSubmit
                            message={`Delete ${group.name} and all links?`}
                            className="p-2"
                          >
                            <Trash2 className="size-3.5" />
                          </ConfirmSubmit>
                        </form>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
            {!groups.length && (
              <Card className="p-12 text-center text-sm text-slate-500">No resource groups.</Card>
            )}
          </div>
          {canEditContent && (
            <Card className="h-fit p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <FolderPlus className="size-4 text-indigo-600" /> Add resource group
              </h2>
              <form action={createResourceGroup} className="mt-4 space-y-3">
                <input type="hidden" name="committee_id" value={id} />
                <input name="name" required className={inputClass} placeholder="Group name" />
                <SubmitButton className="w-full">Add group</SubmitButton>
              </form>
            </Card>
          )}
        </div>
      )}

      {managesAll && (
        <Card className="flex items-center justify-between border-amber-200 p-5">
          <div>
            <h2 className="font-bold">Committee lifecycle</h2>
            <p className="text-xs text-slate-500">
              Archive committees instead of deleting governance history.
            </p>
          </div>
          <form action={setCommitteeStatus}>
            <input type="hidden" name="id" value={id} />
            <input
              type="hidden"
              name="status"
              value={committee.status === "active" ? "archived" : "active"}
            />
            <button className={committee.status === "active" ? secondaryButtonClass : buttonClass}>
              <Archive className="size-4" />
              {committee.status === "active" ? "Archive" : "Restore"}
            </button>
          </form>
        </Card>
      )}
    </>
  );
}
