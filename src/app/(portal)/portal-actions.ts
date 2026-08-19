"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveProfile, requireAdmin } from "@/lib/auth";
import { committeeColors } from "@/lib/committee-colors";
import { serializeRichText } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import { postgresUuid } from "@/lib/validation";
import type { AccessLevel, ActionPriority } from "@/types/database";
import type { AgendaDraftItem } from "@/lib/agenda";

const uuid = postgresUuid;
const richText = (maxLength: number) =>
  z.string().transform((value, context) => {
    try {
      return serializeRichText(value, maxLength);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid formatted text.",
      });
      return z.NEVER;
    }
  });

const agendaItems = z.string().transform((value, context): AgendaDraftItem[] => {
  try {
    return z
      .array(
        z.object({
          id: uuid.optional(),
          title: z.string().trim().min(1).max(500),
          assigneeIds: z.array(uuid).max(50),
        }),
      )
      .min(1, "Add at least one agenda item.")
      .max(100)
      .parse(JSON.parse(value));
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "Invalid agenda items.",
    });
    return z.NEVER;
  }
});

function agendaSummary(items: AgendaDraftItem[]) {
  return items
    .map((item, index) => `${index + 1}. ${item.title}`)
    .join("\n")
    .slice(0, 50000);
}

async function replaceMeetingAgendaItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meetingId: string,
  items: AgendaDraftItem[],
  path: string,
) {
  const { data: existingItems, error: existingError } = await supabase
    .from("meeting_agenda_items")
    .select("id, completed_at, completed_by")
    .eq("meeting_id", meetingId);
  check(existingError, path);
  const existingById = new Map((existingItems ?? []).map((item) => [item.id, item]));
  const { error: deleteError } = await supabase
    .from("meeting_agenda_items")
    .delete()
    .eq("meeting_id", meetingId);
  check(deleteError, path);
  const rows = items.map((item, index) => ({
    id: item.id && existingById.has(item.id) ? item.id : crypto.randomUUID(),
    meeting_id: meetingId,
    title: item.title,
    sort_order: (index + 1) * 10,
    completed_at: item.id ? (existingById.get(item.id)?.completed_at ?? null) : null,
    completed_by: item.id ? (existingById.get(item.id)?.completed_by ?? null) : null,
    assigneeIds: [...new Set(item.assigneeIds)],
  }));
  const { error: itemError } = await supabase.from("meeting_agenda_items").insert(
    rows.map((row) => ({
      id: row.id,
      meeting_id: row.meeting_id,
      title: row.title,
      sort_order: row.sort_order,
      completed_at: row.completed_at,
      completed_by: row.completed_by,
    })),
  );
  check(itemError, path);
  const assignments = rows.flatMap((row) =>
    row.assigneeIds.map((profileId) => ({ agenda_item_id: row.id, profile_id: profileId })),
  );
  if (assignments.length) {
    const { error: assignmentError } = await supabase
      .from("meeting_agenda_item_assignees")
      .insert(assignments);
    check(assignmentError, path);
  }
}

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function fail(path: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function check(error: { message: string } | null, path: string) {
  if (error) fail(path, error.message);
}

export async function createCommittee(formData: FormData) {
  const profile = await requireActiveProfile();
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(200),
      mandate: z.string().trim().max(10000),
      color: z.enum(committeeColors.map((color) => color.value)),
    })
    .safeParse(formObject(formData));
  if (!parsed.success) fail("/committees", parsed.error.issues[0]?.message ?? "Invalid committee.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("committees")
    .insert({ ...parsed.data, created_by: profile.id })
    .select("id")
    .single();
  check(error, "/committees");
  redirect(`/committees/${data!.id}`);
}

export async function updateCommitteeColor(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({
      id: uuid,
      color: z.enum(committeeColors.map((color) => color.value)),
    })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("committees")
    .update({ color: parsed.color })
    .eq("id", parsed.id)
    .select("id")
    .single();
  check(error, `/committees/${parsed.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/committees");
  revalidatePath(`/committees/${parsed.id}`);
}

export async function updateCommittee(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({
      id: uuid,
      name: z.string().trim().min(2).max(200),
      mandate: z.string().trim().max(10000),
    })
    .safeParse(formObject(formData));
  if (!parsed.success) fail("/committees", "Invalid committee values.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("committees")
    .update({ name: parsed.data.name, mandate: parsed.data.mandate })
    .eq("id", parsed.data.id);
  check(error, `/committees/${parsed.data.id}`);
  revalidatePath(`/committees/${parsed.data.id}`);
}

export async function setCommitteeStatus(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({ id: uuid, status: z.enum(["active", "archived"]) })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("committees")
    .update({ status: parsed.status })
    .eq("id", parsed.id);
  check(error, `/committees/${parsed.id}`);
  revalidatePath("/committees");
  revalidatePath(`/committees/${parsed.id}`);
}

export async function addMember(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({ committee_id: uuid, profile_id: uuid, role_id: uuid })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("committee_members").insert(parsed);
  check(error, `/committees/${parsed.committee_id}?tab=members`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function updateMemberRole(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({ id: uuid, committee_id: uuid, role_id: uuid })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("committee_members")
    .update({ role_id: parsed.role_id })
    .eq("id", parsed.id);
  check(error, `/committees/${parsed.committee_id}?tab=members`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function removeMember(formData: FormData) {
  await requireActiveProfile();
  const parsed = z.object({ id: uuid, committee_id: uuid }).parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("committee_members").delete().eq("id", parsed.id);
  check(error, `/committees/${parsed.committee_id}?tab=members`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

const meetingPlanSchema = z.object({
  committee_id: uuid,
  title: z.string().trim().min(2).max(240),
  starts_at: z.string().min(1),
  agenda_items: agendaItems,
  goals: richText(50000),
});

export async function createMeetingPlan(formData: FormData) {
  const profile = await requireActiveProfile();
  const parsed = meetingPlanSchema.parse(formObject(formData));
  const supabase = await createClient();
  const destination = `/committees/${parsed.committee_id}?tab=meetings&meetingView=finalize`;
  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      committee_id: parsed.committee_id,
      title: parsed.title,
      starts_at: new Date(parsed.starts_at).toISOString(),
      agenda: agendaSummary(parsed.agenda_items),
      goals: parsed.goals,
      created_by: profile.id,
      status: "planned",
    })
    .select("id")
    .single();
  check(error, destination);
  await replaceMeetingAgendaItems(supabase, meeting!.id, parsed.agenda_items, destination);
  revalidatePath(`/committees/${parsed.committee_id}`);
  revalidatePath("/dashboard");
  redirect(destination);
}

export async function saveMeetingPlan(formData: FormData) {
  const profile = await requireActiveProfile();
  const parsed = meetingPlanSchema
    .extend({ id: uuid, intent: z.enum(["save", "finalize"]) })
    .parse(formObject(formData));
  const supabase = await createClient();
  const destination = `/committees/${parsed.committee_id}?tab=meetings&meetingView=${parsed.intent === "finalize" ? "upcoming" : "finalize"}`;
  await replaceMeetingAgendaItems(supabase, parsed.id, parsed.agenda_items, destination);
  const changes = {
    title: parsed.title,
    starts_at: new Date(parsed.starts_at).toISOString(),
    agenda: agendaSummary(parsed.agenda_items),
    goals: parsed.goals,
    ...(parsed.intent === "finalize"
      ? {
          status: "scheduled" as const,
          finalized_at: new Date().toISOString(),
          finalized_by: profile.id,
        }
      : {}),
  };
  const { error } = await supabase
    .from("meetings")
    .update(changes)
    .eq("id", parsed.id)
    .eq("status", "planned")
    .select("id")
    .single();
  check(error, destination);
  revalidatePath(`/committees/${parsed.committee_id}`);
  revalidatePath("/dashboard");
  redirect(destination);
}

export async function updateMeeting(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({
      id: uuid,
      committee_id: uuid,
      title: z.string().trim().min(2).max(240),
      agenda_items: agendaItems,
      goals: richText(50000),
      minutes: richText(100000),
    })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({
      title: parsed.title,
      goals: parsed.goals,
      minutes: parsed.minutes,
      agenda: agendaSummary(parsed.agenda_items),
    })
    .eq("id", parsed.id)
    .select("id, status")
    .single();
  check(error, `/committees/${parsed.committee_id}?tab=meetings`);
  await replaceMeetingAgendaItems(
    supabase,
    parsed.id,
    parsed.agenda_items,
    `/committees/${parsed.committee_id}?tab=meetings`,
  );
  revalidatePath(`/committees/${parsed.committee_id}`);
  redirect(
    `/committees/${parsed.committee_id}?tab=meetings&meetingView=in-progress&focus=${parsed.id}#meeting-${parsed.id}`,
  );
}

export async function startMeeting(formData: FormData) {
  await requireActiveProfile();
  const parsed = z.object({ id: uuid, committee_id: uuid }).parse(formObject(formData));
  const supabase = await createClient();
  const { data: currentMeeting, error: currentMeetingError } = await supabase
    .from("meetings")
    .select("id, title")
    .eq("committee_id", parsed.committee_id)
    .eq("status", "in_progress")
    .is("archived_at", null)
    .neq("id", parsed.id)
    .limit(1)
    .maybeSingle();
  check(currentMeetingError, `/committees/${parsed.committee_id}?tab=meetings`);
  if (currentMeeting) {
    const destination = `/committees/${parsed.committee_id}?tab=meetings&meetingView=in-progress&focus=${currentMeeting.id}`;
    fail(
      destination,
      `Complete or archive “${currentMeeting.title}” before starting another meeting.`,
    );
  }
  const { error } = await supabase
    .from("meetings")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", parsed.id)
    .eq("status", "scheduled")
    .select("id")
    .single();
  check(error, `/committees/${parsed.committee_id}?tab=meetings`);
  const { data: members, error: membersError } = await supabase
    .from("committee_members")
    .select("profile_id")
    .eq("committee_id", parsed.committee_id);
  check(membersError, `/committees/${parsed.committee_id}?tab=meetings`);
  if (members?.length) {
    const { error: attendanceError } = await supabase.from("meeting_attendance").upsert(
      members.map((member) => ({
        meeting_id: parsed.id,
        profile_id: member.profile_id,
        present: false,
      })),
      { onConflict: "meeting_id,profile_id", ignoreDuplicates: true },
    );
    check(attendanceError, `/committees/${parsed.committee_id}?tab=meetings`);
  }
  revalidatePath(`/committees/${parsed.committee_id}`);
  revalidatePath("/dashboard");
  redirect(
    `/committees/${parsed.committee_id}?tab=meetings&meetingView=in-progress&focus=${parsed.id}#meeting-${parsed.id}`,
  );
}

export async function completeMeeting(formData: FormData) {
  await requireActiveProfile();
  const parsed = z.object({ id: uuid, committee_id: uuid }).parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ status: "completed" })
    .eq("id", parsed.id)
    .eq("status", "in_progress")
    .select("id")
    .single();
  check(error, `/committees/${parsed.committee_id}?tab=meetings`);
  revalidatePath(`/committees/${parsed.committee_id}`);
  revalidatePath("/dashboard");
  redirect(`/committees/${parsed.committee_id}?tab=meetings&meetingView=in-progress`);
}

export async function setAgendaItemCompletion(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({
      agenda_item_id: uuid,
      committee_id: uuid,
      completed: z.enum(["true", "false"]),
      minutes: z.string().optional(),
    })
    .parse(formObject(formData));
  const isCompleted = parsed.completed === "true";
  const minutes = isCompleted ? richText(100000).parse(parsed.minutes ?? "") : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_agenda_item_completion", {
    agenda_item_id: parsed.agenda_item_id,
    is_completed: isCompleted,
    minutes_value: minutes ?? undefined,
  });
  check(error, `/committees/${parsed.committee_id}?tab=meetings&meetingView=in-progress`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function unlockMeeting(formData: FormData) {
  await requireActiveProfile();
  const parsed = z.object({ id: uuid, committee_id: uuid }).parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ status: "in_progress" })
    .eq("id", parsed.id)
    .eq("status", "completed")
    .select("id")
    .single();
  check(error, `/committees/${parsed.committee_id}?tab=meetings`);
  revalidatePath(`/committees/${parsed.committee_id}`);
  redirect(
    `/committees/${parsed.committee_id}?tab=meetings&meetingView=in-progress&focus=${parsed.id}#meeting-${parsed.id}`,
  );
}

export async function archiveMeeting(formData: FormData) {
  await requireActiveProfile();
  const parsed = z.object({ id: uuid, committee_id: uuid }).parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.id)
    .select("id")
    .single();
  check(error, `/committees/${parsed.committee_id}?tab=meetings`);
  revalidatePath(`/committees/${parsed.committee_id}`);
  revalidatePath("/dashboard");
  redirect(`/committees/${parsed.committee_id}?tab=meetings&meetingView=history`);
}

export async function toggleAttendance(formData: FormData) {
  const profile = await requireActiveProfile();
  const parsed = z
    .object({
      meeting_id: uuid,
      committee_id: uuid,
      profile_id: uuid,
      present: z.enum(["true", "false"]),
    })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_attendance").upsert(
    {
      meeting_id: parsed.meeting_id,
      profile_id: parsed.profile_id,
      present: parsed.present === "true",
      marked_at: new Date().toISOString(),
      marked_by: profile.id,
    },
    { onConflict: "meeting_id,profile_id" },
  );
  check(error, `/committees/${parsed.committee_id}?tab=meetings`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function deleteMeeting(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({
      id: uuid,
      committee_id: uuid,
      meeting_view: z.enum(["upcoming", "in-progress", "finalize", "history"]),
    })
    .parse(formObject(formData));
  const supabase = await createClient();
  const destination = `/committees/${parsed.committee_id}?tab=meetings&meetingView=${parsed.meeting_view}`;
  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", parsed.id)
    .select("id")
    .single();
  check(error, destination);
  revalidatePath(`/committees/${parsed.committee_id}`);
  revalidatePath("/dashboard");
  redirect(destination);
}

export async function createActionItem(formData: FormData) {
  const profile = await requireActiveProfile();
  const parsed = z
    .object({
      meeting_id: uuid,
      committee_id: uuid,
      task: z.string().trim().min(2).max(1000),
      assignee_id: z.string(),
      priority: z.enum(["low", "medium", "high"]),
    })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("action_items").insert({
    meeting_id: parsed.meeting_id,
    task: parsed.task,
    assignee_id: parsed.assignee_id || null,
    priority: parsed.priority as ActionPriority,
    created_by: profile.id,
  });
  check(error, `/committees/${parsed.committee_id}?tab=meetings`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function toggleActionItem(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({ id: uuid, committee_id: uuid, completed: z.enum(["true", "false"]) })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("action_items")
    .update({ completed: parsed.completed === "true" })
    .eq("id", parsed.id);
  check(error, `/committees/${parsed.committee_id}?tab=meetings`);
  revalidatePath(`/committees/${parsed.committee_id}`);
  revalidatePath("/dashboard");
}

export async function deleteActionItem(formData: FormData) {
  await requireActiveProfile();
  const parsed = z.object({ id: uuid, committee_id: uuid }).parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("action_items").delete().eq("id", parsed.id);
  check(error, `/committees/${parsed.committee_id}?tab=meetings`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function createGoal(formData: FormData) {
  const profile = await requireActiveProfile();
  const parsed = z
    .object({
      committee_id: uuid,
      title: z.string().trim().min(2).max(500),
      target_date: z.string(),
    })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("goals").insert({
    committee_id: parsed.committee_id,
    title: parsed.title,
    target_date: parsed.target_date || null,
    created_by: profile.id,
  });
  check(error, `/committees/${parsed.committee_id}?tab=goals`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function toggleGoal(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({ id: uuid, committee_id: uuid, completed: z.enum(["true", "false"]) })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ completed: parsed.completed === "true" })
    .eq("id", parsed.id);
  check(error, `/committees/${parsed.committee_id}?tab=goals`);
  revalidatePath(`/committees/${parsed.committee_id}`);
  revalidatePath("/dashboard");
}

export async function deleteGoal(formData: FormData) {
  await requireActiveProfile();
  const parsed = z.object({ id: uuid, committee_id: uuid }).parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", parsed.id);
  check(error, `/committees/${parsed.committee_id}?tab=goals`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function saveExpectation(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({ committee_id: uuid, role_id: uuid, expectation_text: z.string().max(20000) })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("role_expectations")
    .upsert(parsed, { onConflict: "committee_id,role_id" });
  check(error, `/committees/${parsed.committee_id}?tab=expectations`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function createResourceGroup(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({ committee_id: uuid, name: z.string().trim().min(2).max(160) })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { count } = await supabase
    .from("resource_groups")
    .select("id", { count: "exact", head: true })
    .eq("committee_id", parsed.committee_id);
  const { error } = await supabase
    .from("resource_groups")
    .insert({ ...parsed, sort_order: (count ?? 0) * 10 + 10 });
  check(error, `/committees/${parsed.committee_id}?tab=resources`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function deleteResourceGroup(formData: FormData) {
  await requireActiveProfile();
  const parsed = z.object({ id: uuid, committee_id: uuid }).parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("resource_groups").delete().eq("id", parsed.id);
  check(error, `/committees/${parsed.committee_id}?tab=resources`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function createResourceLink(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({
      committee_id: uuid,
      group_id: uuid,
      title: z.string().trim().min(2).max(240),
      url: z.url().refine((value) => /^https?:/.test(value)),
      description: z.string().trim().max(1000),
    })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { count } = await supabase
    .from("resource_links")
    .select("id", { count: "exact", head: true })
    .eq("group_id", parsed.group_id);
  const { error } = await supabase.from("resource_links").insert({
    group_id: parsed.group_id,
    title: parsed.title,
    url: parsed.url,
    description: parsed.description,
    sort_order: (count ?? 0) * 10 + 10,
  });
  check(error, `/committees/${parsed.committee_id}?tab=resources`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function deleteResourceLink(formData: FormData) {
  await requireActiveProfile();
  const parsed = z.object({ id: uuid, committee_id: uuid }).parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("resource_links").delete().eq("id", parsed.id);
  check(error, `/committees/${parsed.committee_id}?tab=resources`);
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function moveResource(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({
      entity: z.enum(["group", "link"]),
      id: uuid,
      parent_id: uuid,
      committee_id: uuid,
      direction: z.enum(["up", "down"]),
    })
    .parse(formObject(formData));
  const supabase = await createClient();
  const table = parsed.entity === "group" ? "resource_groups" : "resource_links";
  const parentColumn = parsed.entity === "group" ? "committee_id" : "group_id";
  const { data, error } = await supabase
    .from(table)
    .select("id, sort_order")
    .eq(parentColumn, parsed.parent_id)
    .order("sort_order");
  check(error, `/committees/${parsed.committee_id}?tab=resources`);
  const items = (data ?? []) as Array<{ id: string; sort_order: number }>;
  const index = items.findIndex((item) => item.id === parsed.id);
  const target = parsed.direction === "up" ? index - 1 : index + 1;
  if (index >= 0 && target >= 0 && target < items.length) {
    const first = items[index];
    const second = items[target];
    check(
      (await supabase.from(table).update({ sort_order: second.sort_order }).eq("id", first.id))
        .error,
      `/committees/${parsed.committee_id}?tab=resources`,
    );
    check(
      (await supabase.from(table).update({ sort_order: first.sort_order }).eq("id", second.id))
        .error,
      `/committees/${parsed.committee_id}?tab=resources`,
    );
  }
  revalidatePath(`/committees/${parsed.committee_id}`);
}

export async function createCommitteeRole(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      access_level: z.enum(["chair", "staff", "member"]),
    })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("committee_roles").insert({
    name: parsed.name,
    access_level: parsed.access_level as AccessLevel,
    sort_order: 100,
  });
  check(error, "/settings");
  revalidatePath("/settings");
}

export async function deleteCommitteeRole(formData: FormData) {
  await requireActiveProfile();
  const parsed = z.object({ id: uuid }).parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("committee_roles").delete().eq("id", parsed.id);
  check(error, "/settings");
  revalidatePath("/settings");
}

export async function createAllowedDomain(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({
      domain: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
    })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("allowed_email_domains").insert(parsed);
  check(error, "/settings");
  revalidatePath("/settings");
}

export async function toggleAllowedDomain(formData: FormData) {
  await requireActiveProfile();
  const parsed = z
    .object({ id: z.coerce.number().int().positive(), enabled: z.enum(["true", "false"]) })
    .parse(formObject(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("allowed_email_domains")
    .update({ enabled: parsed.enabled === "true" })
    .eq("id", parsed.id);
  check(error, "/settings");
  revalidatePath("/settings");
}

export async function saveAgendaTemplate(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({ agenda_items: agendaItems }).parse(formObject(formData));
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("agenda_template_items")
    .delete()
    .gte("sort_order", 0);
  check(deleteError, "/settings");
  const rows = parsed.agenda_items.map((item, index) => ({
    id: crypto.randomUUID(),
    title: item.title,
    sort_order: (index + 1) * 10,
    assigneeIds: [...new Set(item.assigneeIds)],
  }));
  const { error: itemError } = await supabase
    .from("agenda_template_items")
    .insert(rows.map((row) => ({ id: row.id, title: row.title, sort_order: row.sort_order })));
  check(itemError, "/settings");
  const assignments = rows.flatMap((row) =>
    row.assigneeIds.map((profileId) => ({ agenda_item_id: row.id, profile_id: profileId })),
  );
  if (assignments.length) {
    const { error: assignmentError } = await supabase
      .from("agenda_template_item_assignees")
      .insert(assignments);
    check(assignmentError, "/settings");
  }
  revalidatePath("/settings");
}
