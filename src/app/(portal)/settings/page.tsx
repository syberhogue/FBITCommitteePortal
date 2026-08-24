import { Globe2, LockKeyhole, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminProfile, requireSettingsAccess } from "@/lib/auth";
import { Badge, Card, PageHeader, inputClass, secondaryButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { AgendaItemBuilder } from "@/components/agenda-item-builder";
import {
  createAllowedDomain,
  createAgendaTemplate,
  createCommitteeRole,
  deleteAgendaTemplate,
  deleteCommitteeRole,
  saveAgendaTemplate,
  toggleAllowedDomain,
} from "../portal-actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [profile, params, supabase] = await Promise.all([
    requireSettingsAccess(),
    searchParams,
    createClient(),
  ]);
  const [
    rolesResult,
    domainsResult,
    templatesResult,
    templateItemsResult,
    templateAssignmentsResult,
    peopleResult,
  ] = await Promise.all([
    supabase.from("committee_roles").select("*").order("sort_order"),
    supabase.from("allowed_email_domains").select("*").order("domain"),
    supabase.from("agenda_templates").select("*").is("committee_id", null).order("name"),
    supabase.from("agenda_template_items").select("*").order("sort_order"),
    supabase.from("agenda_template_item_assignees").select("*"),
    supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
  ]);
  const roles = rolesResult.data ?? [];
  const domains = domainsResult.data ?? [];
  const templates = templatesResult.data ?? [];
  const templateItems = templateItemsResult.data ?? [];
  const templateAssignments = templateAssignmentsResult.data ?? [];
  const people = peopleResult.data ?? [];
  const isAdmin = isAdminProfile(profile);
  const templateDraftFor = (templateId: string) =>
    templateItems
      .filter((item) => item.template_id === templateId)
      .map((item) => ({
        id: item.id,
        title: item.title,
        assigneeIds: templateAssignments
          .filter((assignment) => assignment.agenda_item_id === item.id)
          .map((assignment) => assignment.profile_id),
      }));
  return (
    <>
      <PageHeader
        title="System settings"
        description="Committee role definitions, signup controls and shared meeting defaults."
      />
      {params.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{params.error}</p>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-bold text-slate-900">Committee roles</h2>
          <p className="mt-1 text-xs text-slate-500">
            The access tier controls authorization; the display name describes committee duties.
          </p>
          <ul className="mt-5 space-y-2">
            {roles?.map((role) => (
              <li
                key={role.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
              >
                <span className="flex-1 font-medium">{role.name}</span>
                <Badge
                  tone={
                    role.access_level === "chair"
                      ? "indigo"
                      : role.access_level === "staff"
                        ? "green"
                        : "slate"
                  }
                >
                  {role.access_level}
                </Badge>
                {role.is_system ? (
                  <LockKeyhole className="size-4 text-slate-400" />
                ) : isAdmin ? (
                  <form action={deleteCommitteeRole}>
                    <input type="hidden" name="id" value={role.id} />
                    <ConfirmSubmit message={`Delete the ${role.name} role?`} className="p-2">
                      <Trash2 className="size-4" />
                    </ConfirmSubmit>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {isAdmin && (
            <form action={createCommitteeRole} className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input name="name" required className={inputClass} placeholder="New role name" />
              <select name="access_level" className={`${inputClass} sm:w-40`}>
                <option value="member">Member</option>
                <option value="staff">Staff</option>
                <option value="chair">Chair</option>
              </select>
              <SubmitButton>
                <Plus className="size-4" />
                Add
              </SubmitButton>
            </form>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <Globe2 className="size-5 text-indigo-600" /> Allowed signup domains
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            The Auth hook rejects every domain that is not enabled here.
          </p>
          <ul className="mt-5 space-y-2">
            {domains?.map((domain) => (
              <li
                key={domain.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
              >
                <span className="flex-1 font-mono text-sm">@{domain.domain}</span>
                <Badge tone={domain.enabled ? "green" : "red"}>
                  {domain.enabled ? "Enabled" : "Disabled"}
                </Badge>
                {isAdmin && (
                  <form action={toggleAllowedDomain}>
                    <input type="hidden" name="id" value={domain.id} />
                    <input type="hidden" name="enabled" value={String(!domain.enabled)} />
                    <button className={secondaryButtonClass}>
                      {domain.enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {isAdmin && (
            <form action={createAllowedDomain} className="mt-5 flex gap-2">
              <input name="domain" required className={inputClass} placeholder="university.edu" />
              <SubmitButton>Add</SubmitButton>
            </form>
          )}
        </Card>
        <Card className="p-6 xl:col-span-2">
          <h2 className="font-bold">Global agenda templates</h2>
          <p className="mt-1 text-xs text-slate-500">
            Named templates are available from the meeting planner for every committee.
          </p>
          <div className="mt-5 space-y-3">
            {templates.map((template) => (
              <details
                key={template.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <summary className="cursor-pointer font-semibold text-slate-900">
                  {template.name}
                </summary>
                <form action={saveAgendaTemplate} className="mt-4 space-y-4">
                  <input type="hidden" name="id" value={template.id} />
                  <label className="block text-xs font-semibold text-slate-600">
                    Template name
                    <input
                      name="name"
                      defaultValue={template.name}
                      required
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <AgendaItemBuilder initialItems={templateDraftFor(template.id)} people={people} />
                  <SubmitButton>Save template</SubmitButton>
                </form>
                <form action={deleteAgendaTemplate} className="mt-2">
                  <input type="hidden" name="id" value={template.id} />
                  <ConfirmSubmit message={`Delete ${template.name}?`}>
                    <Trash2 className="size-4" /> Delete template
                  </ConfirmSubmit>
                </form>
              </details>
            ))}
            {!templates.length && (
              <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                No global agenda templates have been created.
              </p>
            )}
          </div>
          <details className="mt-5 rounded-xl border border-[#0077CA] bg-[#eef6fb] p-4">
            <summary className="cursor-pointer font-semibold text-[#003C71]">
              Add agenda template
            </summary>
            <form action={createAgendaTemplate} className="mt-4 space-y-4">
              <label className="block text-xs font-semibold text-slate-600">
                Template name
                <input name="name" required className={`${inputClass} mt-1`} />
              </label>
              <AgendaItemBuilder
                initialItems={[{ title: "Call to Order & Attendance Roll Call", assigneeIds: [] }]}
                people={people}
              />
              <SubmitButton>Create template</SubmitButton>
            </form>
          </details>
        </Card>
      </div>
    </>
  );
}
