import {
  Archive,
  CalendarCheck,
  Check,
  ChevronDown,
  CircleCheck,
  CircleDot,
  LockKeyhole,
  Play,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { BlockedStartButton } from "@/components/blocked-start-button";
import { AgendaItemBuilder } from "@/components/agenda-item-builder";
import { AgendaItemsView } from "@/components/agenda-items-view";
import { MeetingWorkspace } from "@/components/meeting-workspace";
import { RichTextEditor } from "@/components/rich-text-editor";
import { RichTextView } from "@/components/rich-text-view";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, dangerButtonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import {
  archiveMeeting,
  completeMeeting,
  createActionItem,
  deleteActionItem,
  deleteMeeting,
  saveMeetingPlan,
  startMeeting,
  toggleActionItem,
  toggleAttendance,
  unlockMeeting,
} from "@/app/(portal)/portal-actions";
import { formatDate } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Meeting = Tables<"meetings">;
type ActionItem = Tables<"action_items">;
type Attendance = Tables<"meeting_attendance">;
type Membership = Tables<"committee_members">;
type AgendaItem = Tables<"meeting_agenda_items">;
type AgendaAssignment = Tables<"meeting_agenda_item_assignees">;
type Person = Pick<Tables<"profiles">, "id" | "full_name">;
type MeetingView = "upcoming" | "in-progress" | "finalize" | "history";

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function statusTone(status: Meeting["status"]): "slate" | "blue" | "orange" | "green" | "red" {
  if (status === "planned") return "orange";
  if (status === "scheduled") return "blue";
  if (status === "in_progress") return "orange";
  if (status === "completed") return "green";
  if (status === "cancelled") return "red";
  return "slate";
}

function statusLabel(status: Meeting["status"]) {
  return status.replaceAll("_", " ");
}

function ArchiveControl({ meeting, committeeId }: { meeting: Meeting; committeeId: string }) {
  return (
    <form action={archiveMeeting}>
      <input type="hidden" name="id" value={meeting.id} />
      <input type="hidden" name="committee_id" value={committeeId} />
      <ConfirmSubmit message={`Archive ${meeting.title}?`} className={secondaryButtonClass}>
        <Archive className="size-4" /> Archive
      </ConfirmSubmit>
    </form>
  );
}

function DeleteControl({
  meeting,
  committeeId,
  meetingView,
}: {
  meeting: Meeting;
  committeeId: string;
  meetingView: MeetingView;
}) {
  return (
    <form action={deleteMeeting}>
      <input type="hidden" name="id" value={meeting.id} />
      <input type="hidden" name="committee_id" value={committeeId} />
      <input type="hidden" name="meeting_view" value={meetingView} />
      <ConfirmSubmit
        message={`Permanently delete ${meeting.title} and all of its attendance and action records? This cannot be undone.`}
        className={dangerButtonClass}
      >
        <Trash2 className="size-4" /> Delete permanently
      </ConfirmSubmit>
    </form>
  );
}

function AttendanceList({
  meeting,
  memberships,
  attendance,
  committeeId,
  peopleById,
  editable,
}: {
  meeting: Meeting;
  memberships: Membership[];
  attendance: Attendance[];
  committeeId: string;
  peopleById: Map<string, Person>;
  editable: boolean;
}) {
  const attendanceByProfile = new Map(attendance.map((record) => [record.profile_id, record]));
  const presentCount = attendance.filter((record) => record.present).length;
  return (
    <section className="mt-5 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold">
          <Users className="size-4 text-[#0077CA]" /> Attendance
        </h3>
        <Badge tone="blue">
          {presentCount}/{memberships.length} present
        </Badge>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map((membership) => {
          const present = attendanceByProfile.get(membership.profile_id)?.present ?? false;
          const personName = peopleById.get(membership.profile_id)?.full_name ?? "Unknown member";
          return (
            <li key={membership.profile_id}>
              {editable ? (
                <form action={toggleAttendance}>
                  <input type="hidden" name="meeting_id" value={meeting.id} />
                  <input type="hidden" name="committee_id" value={committeeId} />
                  <input type="hidden" name="profile_id" value={membership.profile_id} />
                  <input type="hidden" name="present" value={String(!present)} />
                  <button
                    className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition ${present ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-600 hover:border-[#0077CA]"}`}
                    aria-label={`${present ? "Mark absent" : "Mark present"}: ${personName}`}
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded border ${present ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}
                    >
                      {present && <Check className="size-3.5" />}
                    </span>
                    <span className="truncate">{personName}</span>
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm">
                  <span
                    className={`size-2.5 rounded-full ${present ? "bg-emerald-600" : "bg-slate-300"}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{personName}</span>
                  <span className="text-xs text-slate-500">{present ? "Present" : "Absent"}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ActionList({
  actions,
  committeeId,
  peopleById,
  editable,
}: {
  actions: ActionItem[];
  committeeId: string;
  peopleById: Map<string, Person>;
  editable: boolean;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {actions.map((action) => (
        <li
          key={action.id}
          className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center"
        >
          {editable ? (
            <form action={toggleActionItem}>
              <input type="hidden" name="id" value={action.id} />
              <input type="hidden" name="committee_id" value={committeeId} />
              <input type="hidden" name="completed" value={String(!action.completed)} />
              <button
                aria-label={action.completed ? "Mark incomplete" : "Mark complete"}
                className={`grid size-5 place-items-center rounded-full border-2 ${action.completed ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}
              >
                {action.completed && <CircleCheck className="size-3.5" />}
              </button>
            </form>
          ) : (
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${action.completed ? "border-emerald-600 bg-emerald-600 text-white" : "border-amber-500 bg-white"}`}
            >
              {action.completed && <CircleCheck className="size-3.5" />}
            </span>
          )}
          <span
            className={`flex-1 text-sm ${action.completed ? "text-slate-500 line-through" : ""}`}
          >
            {action.task}
          </span>
          <span className="text-xs text-slate-500">
            {peopleById.get(action.assignee_id ?? "")?.full_name ?? "Unassigned"}
          </span>
          <Badge
            tone={
              action.priority === "high" ? "red" : action.priority === "medium" ? "orange" : "green"
            }
          >
            {action.priority}
          </Badge>
          <Badge tone={action.completed ? "green" : "orange"}>
            {action.completed ? "done" : "outstanding"}
          </Badge>
          {editable && (
            <form action={deleteActionItem}>
              <input type="hidden" name="id" value={action.id} />
              <input type="hidden" name="committee_id" value={committeeId} />
              <ConfirmSubmit message="Delete this action item?" className="p-1.5">
                ×
              </ConfirmSubmit>
            </form>
          )}
        </li>
      ))}
      {!actions.length && <li className="text-sm italic text-slate-400">No action items.</li>}
    </ul>
  );
}

function MeetingDetailsView({
  meeting,
  agendaItems,
  agendaAssignments,
  peopleById,
  compact = false,
  muted = false,
}: {
  meeting: Meeting;
  agendaItems: AgendaItem[];
  agendaAssignments: AgendaAssignment[];
  peopleById: Map<string, Person>;
  compact?: boolean;
  muted?: boolean;
}) {
  const sectionClass = muted
    ? "rounded-xl border border-slate-300 bg-slate-100 p-4"
    : "rounded-xl border border-slate-200 bg-white p-4";
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-3">
      <section className={sectionClass}>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Agenda</h3>
        <AgendaItemsView
          items={agendaItems}
          assignments={agendaAssignments}
          peopleById={peopleById}
          compact={compact}
        />
      </section>
      <section className={sectionClass}>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Meeting goals</h3>
        <RichTextView
          value={meeting.goals}
          emptyText="No meeting goals have been recorded."
          compact={compact}
        />
      </section>
      <section className={sectionClass}>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Meeting notes / minutes
        </h3>
        <RichTextView
          value={meeting.minutes}
          emptyText="No meeting notes have been recorded."
          compact={compact}
        />
      </section>
    </div>
  );
}

export function MeetingCard({
  meeting,
  actions,
  attendance,
  agendaItems,
  agendaAssignments,
  committeeId,
  memberships,
  people,
  canPlan,
  canFinalize,
  canUnlock,
  canArchive,
  canDelete,
  meetingView,
  upcomingTone = "next",
  activeMeeting,
}: {
  meeting: Meeting;
  actions: ActionItem[];
  attendance: Attendance[];
  agendaItems: AgendaItem[];
  agendaAssignments: AgendaAssignment[];
  committeeId: string;
  memberships: Membership[];
  people: Person[];
  canPlan: boolean;
  canFinalize: boolean;
  canUnlock: boolean;
  canArchive: boolean;
  canDelete: boolean;
  meetingView: MeetingView;
  upcomingTone?: "next" | "other";
  activeMeeting?: { id: string; title: string } | null;
}) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const completedActionCount = actions.filter((action) => action.completed).length;
  const archived = Boolean(meeting.archived_at);

  if (meeting.status === "completed" || meeting.status === "cancelled" || archived) {
    return (
      <Card className="overflow-hidden border-slate-200">
        <details className="group">
          <summary className="flex cursor-pointer list-none flex-col gap-3 bg-slate-50 p-5 sm:flex-row sm:items-center [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-5 shrink-0 text-[#003C71] transition-transform group-open:rotate-180" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-bold text-slate-900">{meeting.title}</h2>
                <Badge tone={archived ? "slate" : meeting.status === "cancelled" ? "red" : "green"}>
                  {archived ? "Archived" : statusLabel(meeting.status)}
                </Badge>
                {meeting.status === "completed" && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <LockKeyhole className="size-3.5" /> Locked record
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">{formatDate(meeting.starts_at, true)}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              {completedActionCount}/{actions.length} actions complete
            </span>
          </summary>
          <div className="p-5 text-sm">
            <MeetingDetailsView
              meeting={meeting}
              agendaItems={agendaItems}
              agendaAssignments={agendaAssignments}
              peopleById={peopleById}
              compact
              muted
            />
            <AttendanceList
              meeting={meeting}
              memberships={memberships}
              attendance={attendance}
              committeeId={committeeId}
              peopleById={peopleById}
              editable={false}
            />
            <div className="mt-5 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-bold">Action items</h3>
              <ActionList
                actions={actions}
                committeeId={committeeId}
                peopleById={peopleById}
                editable={false}
              />
            </div>
          </div>
        </details>
        {((!archived && (canUnlock || canArchive)) || canDelete) && (
          <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {!archived && meeting.status === "completed" && canUnlock && (
              <form action={unlockMeeting}>
                <input type="hidden" name="id" value={meeting.id} />
                <input type="hidden" name="committee_id" value={committeeId} />
                <SubmitButton>
                  <RotateCcw className="size-4" /> Unlock meeting
                </SubmitButton>
              </form>
            )}
            {!archived && canArchive && (
              <ArchiveControl meeting={meeting} committeeId={committeeId} />
            )}
            {canDelete && (
              <DeleteControl
                meeting={meeting}
                committeeId={committeeId}
                meetingView={meetingView}
              />
            )}
          </div>
        )}
      </Card>
    );
  }

  if (meeting.status === "planned") {
    return (
      <Card className={`p-6 ${canPlan ? "border-[#E75D2A]" : "border-slate-300 bg-slate-100"}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone="orange">Plan awaiting Chair finalization</Badge>
            {!canPlan && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <LockKeyhole className="size-3.5" /> Read only for your role
              </span>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Proposed for {formatDate(meeting.starts_at, true)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canArchive && <ArchiveControl meeting={meeting} committeeId={committeeId} />}
            {canDelete && (
              <DeleteControl
                meeting={meeting}
                committeeId={committeeId}
                meetingView={meetingView}
              />
            )}
          </div>
        </div>
        {canPlan ? (
          <form action={saveMeetingPlan} className="space-y-4">
            <input type="hidden" name="id" value={meeting.id} />
            <input type="hidden" name="committee_id" value={committeeId} />
            <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
              <input
                name="title"
                defaultValue={meeting.title}
                required
                className={inputClass}
                aria-label="Meeting title"
              />
              <input
                name="starts_at"
                type="datetime-local"
                defaultValue={toLocalInput(meeting.starts_at)}
                required
                className={inputClass}
                aria-label="Proposed meeting time"
              />
            </div>
            <AgendaItemBuilder
              initialItems={[...agendaItems]
                .sort((left, right) => left.sort_order - right.sort_order)
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  assigneeIds: agendaAssignments
                    .filter((assignment) => assignment.agenda_item_id === item.id)
                    .map((assignment) => assignment.profile_id),
                }))}
              people={people}
            />
            <div>
              <RichTextEditor name="goals" label="Meeting goals" initialValue={meeting.goals} />
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton name="intent" value="save">
                Save plan
              </SubmitButton>
              <input
                name="template_name"
                className={`${inputClass} sm:w-64`}
                placeholder="Committee template name"
              />
              <SubmitButton name="intent" value="save_template">
                Save agenda as template
              </SubmitButton>
              {canFinalize && (
                <SubmitButton name="intent" value="finalize" pendingLabel="Finalizing…">
                  <CalendarCheck className="size-4" /> Finalize and schedule
                </SubmitButton>
              )}
            </div>
          </form>
        ) : (
          <>
            <h2 className="text-xl font-bold">{meeting.title}</h2>
            <MeetingDetailsView
              meeting={meeting}
              agendaItems={agendaItems}
              agendaAssignments={agendaAssignments}
              peopleById={peopleById}
              muted
            />
          </>
        )}
      </Card>
    );
  }

  if (meeting.status === "scheduled") {
    const editableSummaryClass =
      upcomingTone === "next" ? "border-[#0077CA] bg-[#e7f2fa]" : "border-[#E75D2A] bg-orange-50";
    return (
      <Card
        className={`overflow-hidden ${canPlan ? editableSummaryClass.split(" ")[0] : "border-slate-300"}`}
      >
        <details className="group">
          <summary
            className={`flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden ${canPlan ? editableSummaryClass.split(" ")[1] : "bg-slate-200 text-slate-600"}`}
          >
            <ChevronDown className="size-5 shrink-0 text-[#003C71] transition-transform group-open:rotate-180" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-bold">{meeting.title}</h2>
                <Badge tone={upcomingTone === "next" ? "blue" : "orange"}>Scheduled</Badge>
                {!canPlan && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <LockKeyhole className="size-3.5" /> Read only for your role
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-semibold text-[#003C71]">
                {formatDate(meeting.starts_at, true)}
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 group-open:hidden">Inspect</span>
          </summary>
          <div className={canPlan ? "p-5" : "bg-slate-50 p-5 text-slate-600"}>
            <MeetingDetailsView
              meeting={meeting}
              agendaItems={agendaItems}
              agendaAssignments={agendaAssignments}
              peopleById={peopleById}
              muted={!canPlan}
            />
          </div>
        </details>
        {(canPlan || canArchive || canDelete) && (
          <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-white px-5 py-3">
            {canPlan &&
              (activeMeeting ? (
                <BlockedStartButton committeeId={committeeId} activeMeeting={activeMeeting} />
              ) : (
                <form action={startMeeting}>
                  <input type="hidden" name="id" value={meeting.id} />
                  <input type="hidden" name="committee_id" value={committeeId} />
                  <SubmitButton pendingLabel="Starting…">
                    <Play className="size-4" /> Start meeting
                  </SubmitButton>
                </form>
              ))}
            {canArchive && <ArchiveControl meeting={meeting} committeeId={committeeId} />}
            {canDelete && (
              <DeleteControl
                meeting={meeting}
                committeeId={committeeId}
                meetingView={meetingView}
              />
            )}
          </div>
        )}
      </Card>
    );
  }

  const editable = meeting.status === "in_progress" && canPlan;
  return (
    <Card
      className={`p-6 ${editable ? "border-[#E75D2A]" : "border-slate-300 bg-slate-100 text-slate-600"}`}
    >
      <div
        role="status"
        className="mb-5 flex flex-col gap-2 rounded-xl border border-[#E75D2A] bg-orange-50 p-4 text-[#003C71] sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="flex items-center gap-2 font-bold">
          <CircleDot className="size-5 animate-pulse text-[#E75D2A]" /> Meeting has started
        </span>
        <span className="text-sm font-semibold">
          {meeting.started_at
            ? `Started ${formatDate(meeting.started_at, true)}`
            : "Started time unavailable"}
        </span>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge tone={statusTone(meeting.status)}>{statusLabel(meeting.status)}</Badge>
          {!editable && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <LockKeyhole className="size-3.5" /> Read only for your role
            </span>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Scheduled {formatDate(meeting.starts_at, true)}
            {meeting.started_at ? ` · Started ${formatDate(meeting.started_at, true)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canArchive && <ArchiveControl meeting={meeting} committeeId={committeeId} />}
          {canDelete && (
            <DeleteControl meeting={meeting} committeeId={committeeId} meetingView={meetingView} />
          )}
        </div>
      </div>
      {editable ? (
        <MeetingWorkspace
          meeting={meeting}
          committeeId={committeeId}
          agendaItems={agendaItems}
          assignments={agendaAssignments}
          people={people}
        />
      ) : (
        <>
          <h2 className="text-xl font-bold">{meeting.title}</h2>
          <MeetingDetailsView
            meeting={meeting}
            agendaItems={agendaItems}
            agendaAssignments={agendaAssignments}
            peopleById={peopleById}
            muted
          />
        </>
      )}
      <AttendanceList
        meeting={meeting}
        memberships={memberships}
        attendance={attendance}
        committeeId={committeeId}
        peopleById={peopleById}
        editable={editable}
      />
      <div className="mt-6 border-t border-slate-100 pt-5">
        <h3 className="font-bold">Action items</h3>
        <ActionList
          actions={actions}
          committeeId={committeeId}
          peopleById={peopleById}
          editable={editable}
        />
        {editable && (
          <form
            action={createActionItem}
            className="mt-3 grid gap-2 md:grid-cols-[1fr_13rem_8rem_auto]"
          >
            <input type="hidden" name="meeting_id" value={meeting.id} />
            <input type="hidden" name="committee_id" value={committeeId} />
            <input name="task" required className={inputClass} placeholder="New action item" />
            <select name="assignee_id" className={inputClass}>
              <option value="">Unassigned</option>
              {memberships.map((membership) => (
                <option key={membership.profile_id} value={membership.profile_id}>
                  {peopleById.get(membership.profile_id)?.full_name}
                </option>
              ))}
            </select>
            <select name="priority" className={inputClass}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <SubmitButton>Add</SubmitButton>
          </form>
        )}
      </div>
      {editable && (
        <form action={completeMeeting} className="mt-6 border-t border-slate-200 pt-4">
          <input type="hidden" name="id" value={meeting.id} />
          <input type="hidden" name="committee_id" value={committeeId} />
          <ConfirmSubmit message="Complete and lock this meeting?" className={secondaryButtonClass}>
            <LockKeyhole className="size-4" /> Complete and lock
          </ConfirmSubmit>
        </form>
      )}
    </Card>
  );
}
