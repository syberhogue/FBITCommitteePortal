import { connection } from "next/server";
import Link from "next/link";
import {
  Activity,
  Archive,
  Download,
  MailPlus,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserRoundCog,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageHeader, inputClass, secondaryButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { AdminUserRow } from "@/components/admin-user-row";
import { formatBytes, formatDate } from "@/lib/utils";
import {
  deleteCommittee,
  importCommitteesCsv,
  importPersonnelCsv,
  inviteUser,
  updateCommitteeStatus,
} from "./admin-actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    error?: string;
    message?: string;
    adminTab?: string;
  }>;
}) {
  await connection();
  const [actor, params] = await Promise.all([requireAdmin(), searchParams]);
  const admin = createAdminClient();
  const supabase = await createClient();
  const activeTab =
    params.adminTab === "committees" ||
    params.adminTab === "analytics" ||
    params.adminTab === "audit"
      ? params.adminTab
      : "users";
  const tabClass = (tab: "users" | "committees" | "analytics" | "audit") =>
    [
      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
      activeTab === tab ? "bg-[#003C71] text-white" : "text-slate-600 hover:bg-slate-100",
    ].join(" ");
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 50;
  const [
    authResult,
    profilesResult,
    committeesResult,
    membershipsResult,
    meetingsResult,
    actionsResult,
    goalsResult,
    activityResult,
    backupsResult,
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page, perPage }),
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase
      .from("committees")
      .select("id, name, short_name, status, color, created_at")
      .order("name"),
    supabase.from("committee_members").select("id, role_id, committee_id"),
    supabase.from("meetings").select("id, committee_id, created_at"),
    supabase.from("action_items").select("id, priority, completed, created_at, completed_at"),
    supabase.from("goals").select("id, completed"),
    supabase
      .from("activity_log")
      .select("id, event_type, entity_type, details, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("backup_runs").select("*").order("started_at", { ascending: false }).limit(15),
  ]);
  const authUsers = authResult.data?.users ?? [];
  const profiles = profilesResult.data ?? [];
  const committees = committeesResult.data ?? [];
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const visibleProfiles = profiles.filter(
    (profile) =>
      !params.q ||
      `${profile.full_name} ${profile.email}`.toLowerCase().includes(params.q.toLowerCase()),
  );
  const actions = actionsResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const memberships = membershipsResult.data ?? [];
  const meetings = meetingsResult.data ?? [];
  const latestBackup = backupsResult.data?.find((run) => run.status === "succeeded");
  const membershipCountsByCommittee = new Map<string, number>();
  const meetingCountsByCommittee = new Map<string, number>();
  memberships.forEach((membership) =>
    membershipCountsByCommittee.set(
      membership.committee_id,
      (membershipCountsByCommittee.get(membership.committee_id) ?? 0) + 1,
    ),
  );
  meetings.forEach((meeting) =>
    meetingCountsByCommittee.set(
      meeting.committee_id,
      (meetingCountsByCommittee.get(meeting.committee_id) ?? 0) + 1,
    ),
  );
  const metrics = [
    {
      label: "Active users",
      value: profiles.filter((p) => p.status === "active").length,
      icon: UserCheck,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Pending approval",
      value: profiles.filter((p) => p.status === "pending").length,
      icon: Users,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      label: "Active committees",
      value: committees.filter((c) => c.status === "active").length,
      icon: ShieldCheck,
      tone: "bg-indigo-100 text-indigo-700",
    },
    {
      label: "Open actions",
      value: actions.filter((a) => !a.completed).length,
      icon: Activity,
      tone: "bg-blue-100 text-blue-700",
    },
  ];

  return (
    <>
      <PageHeader
        title="Administration"
        description="Secure user access, application operations, governance analytics and backup health."
        action={
          <a href="/api/admin/export" className={secondaryButtonClass}>
            <Download className="size-4" /> Export CSV
          </a>
        }
      />
      {params.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {params.error}
        </p>
      )}
      {params.message && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{params.message}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="flex items-center gap-4 p-5">
            <span className={`grid size-11 place-items-center rounded-xl ${tone}`}>
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <Card className="h-fit p-2 lg:sticky lg:top-28">
          <nav className="space-y-1" aria-label="Administration sections">
            <Link href="/admin?adminTab=users" className={tabClass("users")}>
              <Users className="size-4" /> Users Management
            </Link>
            <Link href="/admin?adminTab=committees" className={tabClass("committees")}>
              <ShieldCheck className="size-4" /> Committee Management
            </Link>
            <Link href="/admin?adminTab=analytics" className={tabClass("analytics")}>
              <Activity className="size-4" /> Governance Analytics
            </Link>
            <Link href="/admin?adminTab=audit" className={tabClass("audit")}>
              <UserRoundCog className="size-4" /> Administrative Audit
            </Link>
          </nav>
        </Card>
        <div className="min-w-0 space-y-6">
          {activeTab === "users" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
              <Card className="overflow-hidden">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-bold">User management</h2>
                    <p className="text-xs text-slate-500">
                      Role and status changes take effect immediately through RLS.
                    </p>
                  </div>
                  <form className="flex gap-2">
                    <input
                      name="q"
                      defaultValue={params.q}
                      className={inputClass}
                      placeholder="Search users…"
                    />
                    <button className={secondaryButtonClass}>Search</button>
                  </form>
                </div>
                <div className="divide-y divide-slate-100">
                  {visibleProfiles.map((profile) => {
                    const authUser = authById.get(profile.id);
                    return (
                      <AdminUserRow
                        key={profile.id}
                        profile={profile}
                        isCurrentUser={profile.id === actor.id}
                        lastSignIn={authUser?.last_sign_in_at}
                      />
                    );
                  })}
                </div>
              </Card>
              <div className="space-y-6">
                <Card className="p-5">
                  <h2 className="flex items-center gap-2 font-bold">
                    <MailPlus className="size-4 text-indigo-600" /> Invite user
                  </h2>
                  <form action={inviteUser} className="mt-4 space-y-3">
                    <input
                      name="full_name"
                      required
                      className={inputClass}
                      placeholder="Full name"
                    />
                    <input
                      name="email"
                      type="email"
                      required
                      className={inputClass}
                      placeholder="name@university.edu"
                    />
                    <SubmitButton className="w-full">Send invitation</SubmitButton>
                  </form>
                </Card>
                <Card className="p-5">
                  <h2 className="flex items-center gap-2 font-bold">
                    <Upload className="size-4 text-indigo-600" /> Import personnel CSV
                  </h2>
                  <p className="mt-2 text-xs text-slate-500">
                    One row per committee assignment. Required columns: email, full_name, committee,
                    role. Optional: status, global_role, person_category, department, title.
                  </p>
                  <a
                    href="/api/admin/templates/personnel"
                    className={`${secondaryButtonClass} mt-4 w-full justify-center`}
                  >
                    <Download className="size-4" /> Download template
                  </a>
                  <form action={importPersonnelCsv} className="mt-4 space-y-3">
                    <input
                      name="file"
                      type="file"
                      accept=".csv,text/csv"
                      required
                      className={inputClass}
                    />
                    <SubmitButton className="w-full">Import personnel</SubmitButton>
                  </form>
                  <p className="mt-3 text-[11px] text-slate-500">
                    Committee can be the full name or acronym. Repeat an email across rows to assign
                    that person to multiple committees.
                  </p>
                </Card>
                <Card className="p-5">
                  <h2 className="flex items-center gap-2 font-bold">
                    <Archive className="size-4 text-indigo-600" /> Backup health
                  </h2>
                  {latestBackup ? (
                    <div className="mt-4 space-y-2 text-sm">
                      <p>
                        <span className="text-slate-500">Last success:</span>{" "}
                        {formatDate(latestBackup.finished_at, true)}
                      </p>
                      <p>
                        <span className="text-slate-500">Size:</span>{" "}
                        {formatBytes(latestBackup.size_bytes)}
                      </p>
                      <p className="truncate">
                        <span className="text-slate-500">Object:</span> {latestBackup.object_key}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        {latestBackup.checksum_sha256}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      No successful backup has been reported. Configure the host job before launch.
                    </p>
                  )}
                  <p className="mt-4 text-xs text-slate-500">
                    35 daily and 12 monthly encrypted off-site generations. Restores are
                    operator-only.
                  </p>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "committees" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
              <Card className="overflow-hidden">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-bold">Committee management</h2>
                    <p className="text-xs text-slate-500">
                      Archive committees for normal lifecycle changes. Delete permanently removes
                      the committee and linked committee records.
                    </p>
                  </div>
                  <Badge tone="indigo">{committees.length} total</Badge>
                </div>
                <div className="divide-y divide-slate-100">
                  {committees.map((committee) => (
                    <div
                      key={committee.id}
                      className="grid gap-3 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="size-3 rounded-full"
                            style={{ backgroundColor: committee.color }}
                            aria-hidden
                          />
                          <a
                            href={`/committees/${committee.id}`}
                            className="truncate font-bold text-slate-950 hover:underline"
                          >
                            {committee.name}
                          </a>
                          {committee.short_name && (
                            <Badge tone="slate">{committee.short_name}</Badge>
                          )}
                          <Badge tone={committee.status === "active" ? "green" : "slate"}>
                            {committee.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {membershipCountsByCommittee.get(committee.id) ?? 0} members ·{" "}
                          {meetingCountsByCommittee.get(committee.id) ?? 0} meetings · Created{" "}
                          {formatDate(committee.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <form action={updateCommitteeStatus}>
                          <input type="hidden" name="id" value={committee.id} />
                          <input type="hidden" name="name" value={committee.name} />
                          <input
                            type="hidden"
                            name="status"
                            value={committee.status === "active" ? "archived" : "active"}
                          />
                          <button
                            className={
                              committee.status === "active"
                                ? "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                                : secondaryButtonClass
                            }
                          >
                            {committee.status === "active" ? "Archive" : "Restore"}
                          </button>
                        </form>
                        <form action={deleteCommittee}>
                          <input type="hidden" name="id" value={committee.id} />
                          <input type="hidden" name="name" value={committee.name} />
                          <ConfirmSubmit
                            message={`Permanently delete ${committee.name}? This also removes linked members, meetings, goals, resources, and agenda templates.`}
                          >
                            <Trash2 className="size-4" /> Delete
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </div>
                  ))}
                  {!committees.length && (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No committees have been created yet.
                    </div>
                  )}
                </div>
              </Card>
              <div className="space-y-6">
                <Card className="p-5">
                  <h2 className="flex items-center gap-2 font-bold">
                    <Upload className="size-4 text-indigo-600" /> Import committee CSV
                  </h2>
                  <p className="mt-2 text-xs text-slate-500">
                    Required columns: name, short_name. Optional: mandate, color, status.
                  </p>
                  <a
                    href="/api/admin/templates/committees"
                    className={`${secondaryButtonClass} mt-4 w-full justify-center`}
                  >
                    <Download className="size-4" /> Download template
                  </a>
                  <form action={importCommitteesCsv} className="mt-4 space-y-3">
                    <input
                      name="file"
                      type="file"
                      accept=".csv,text/csv"
                      required
                      className={inputClass}
                    />
                    <SubmitButton className="w-full">Import committees</SubmitButton>
                  </form>
                  <p className="mt-3 text-[11px] text-slate-500">
                    Use acronym as a header alias for short_name when needed.
                  </p>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <Card className="p-6">
              <h2 className="font-bold">Governance analytics</h2>
              <div className="mt-5 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
                {[
                  ["Memberships", membershipsResult.data?.length ?? 0],
                  ["Meetings", meetingsResult.data?.length ?? 0],
                  ["Completed actions", actions.filter((a) => a.completed).length],
                  ["Completed goals", goals.filter((g) => g.completed).length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-50 p-4">
                    <p className="text-2xl font-bold text-indigo-700">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase text-slate-500">
                  Outstanding by priority
                </h3>
                <div className="mt-2 flex gap-2">
                  <Badge tone="red">
                    {actions.filter((a) => !a.completed && a.priority === "high").length} high
                  </Badge>
                  <Badge tone="amber">
                    {actions.filter((a) => !a.completed && a.priority === "medium").length} medium
                  </Badge>
                  <Badge tone="green">
                    {actions.filter((a) => !a.completed && a.priority === "low").length} low
                  </Badge>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "audit" && (
            <Card className="p-6">
              <h2 className="font-bold">Administrative audit</h2>
              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
                {activityResult.data?.map((event) => (
                  <div key={event.id} className="flex gap-3 border-b border-slate-100 pb-3">
                    <UserRoundCog className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {event.event_type} Â· {event.entity_type}
                      </p>
                      <p className="text-xs text-slate-400">{formatDate(event.created_at, true)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
