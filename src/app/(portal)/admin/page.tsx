import {
  Activity,
  Archive,
  Download,
  MailPlus,
  ShieldCheck,
  UserCheck,
  UserRoundCog,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, Card, PageHeader, inputClass, secondaryButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatBytes, formatDate } from "@/lib/utils";
import { deleteUser, inviteUser, sendPasswordReset, updateUserAccess } from "./admin-actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; error?: string; message?: string }>;
}) {
  const [actor, params] = await Promise.all([requireAdmin(), searchParams]);
  const admin = createAdminClient();
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
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("committees").select("id, status, created_at"),
    admin.from("committee_members").select("id, role_id"),
    admin.from("meetings").select("id, created_at"),
    admin.from("action_items").select("id, priority, completed, created_at, completed_at"),
    admin.from("goals").select("id, completed"),
    admin
      .from("activity_log")
      .select("id, event_type, entity_type, details, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    admin.from("backup_runs").select("*").order("started_at", { ascending: false }).limit(15),
  ]);
  const authUsers = authResult.data?.users ?? [];
  const profiles = profilesResult.data ?? [];
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const visibleProfiles = profiles.filter(
    (profile) =>
      !params.q ||
      `${profile.full_name} ${profile.email}`.toLowerCase().includes(params.q.toLowerCase()),
  );
  const actions = actionsResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const latestBackup = backupsResult.data?.find((run) => run.status === "succeeded");
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
      value: committeesResult.data?.filter((c) => c.status === "active").length ?? 0,
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
                <div key={profile.id} className="p-5">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row">
                    <div>
                      <p className="font-bold">
                        {profile.full_name}{" "}
                        {profile.id === actor.id && <Badge tone="indigo">You</Badge>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {profile.email} · Last sign-in {formatDate(authUser?.last_sign_in_at, true)}
                      </p>
                    </div>
                    <Badge
                      tone={
                        profile.status === "active"
                          ? "green"
                          : profile.status === "pending"
                            ? "amber"
                            : "red"
                      }
                    >
                      {profile.status}
                    </Badge>
                  </div>
                  <form action={updateUserAccess} className="mt-4 grid gap-2 lg:grid-cols-3">
                    <input type="hidden" name="id" value={profile.id} />
                    <select name="status" defaultValue={profile.status} className={inputClass}>
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <select
                      name="global_role"
                      defaultValue={profile.global_role}
                      className={inputClass}
                    >
                      <option value="faculty">Faculty</option>
                      <option value="staff">Staff</option>
                      <option value="dean">Dean</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select
                      name="person_category"
                      defaultValue={profile.person_category}
                      className={inputClass}
                    >
                      <option value="faculty">Faculty category</option>
                      <option value="staff">Staff category</option>
                      <option value="admin">Admin category</option>
                    </select>
                    <input
                      name="department"
                      defaultValue={profile.department ?? ""}
                      className={inputClass}
                      placeholder="Department"
                    />
                    <input
                      name="title"
                      defaultValue={profile.title ?? ""}
                      className={inputClass}
                      placeholder="Title"
                    />
                    <SubmitButton>Save access</SubmitButton>
                  </form>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={sendPasswordReset}>
                      <input type="hidden" name="id" value={profile.id} />
                      <input type="hidden" name="email" value={profile.email} />
                      <button className={secondaryButtonClass}>Send password reset</button>
                    </form>
                    {profile.id !== actor.id && (
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={profile.id} />
                        <input type="hidden" name="email" value={profile.email} />
                        <ConfirmSubmit
                          message={`Permanently delete ${profile.email}? Existing refresh sessions will be revoked.`}
                        >
                          Delete account
                        </ConfirmSubmit>
                      </form>
                    )}
                  </div>
                </div>
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
              <input name="full_name" required className={inputClass} placeholder="Full name" />
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
              35 daily and 12 monthly encrypted off-site generations. Restores are operator-only.
            </p>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
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
            <h3 className="text-xs font-bold uppercase text-slate-500">Outstanding by priority</h3>
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
        <Card className="p-6">
          <h2 className="font-bold">Administrative audit</h2>
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
            {activityResult.data?.map((event) => (
              <div key={event.id} className="flex gap-3 border-b border-slate-100 pb-3">
                <UserRoundCog className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {event.event_type} · {event.entity_type}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(event.created_at, true)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
