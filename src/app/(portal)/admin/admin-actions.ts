"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { z } from "zod";
import { postgresUuid } from "@/lib/validation";
import { requireAdmin } from "@/lib/auth";
import { committeeColors } from "@/lib/committee-colors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";

async function assertTrustedOrigin() {
  const env = getServerEnv();
  if (env.DEPLOYMENT_ENV !== "production") return;
  const origin = (await headers()).get("origin");
  if (!origin || new URL(origin).origin !== new URL(env.NEXT_PUBLIC_APP_URL).origin) {
    throw new Error("Untrusted request origin.");
  }
}

function fail(message: string): never {
  redirect(`/admin?error=${encodeURIComponent(message)}`);
}

async function audit(
  actorId: string,
  eventType: string,
  entityId: string | null,
  label: string,
  entityType = "auth_user",
) {
  const admin = createAdminClient();
  await admin.from("activity_log").insert({
    actor_id: actorId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    details: { label },
  });
}

type CsvRow = Record<string, string>;
type HeaderAliases = Record<string, string>;

const personnelHeaderAliases: HeaderAliases = {
  name: "full_name",
  acronym: "committee",
  committee_name: "committee",
  committee_acronym: "committee",
  committee_short_name: "committee",
  committee_role: "role",
};

const committeeHeaderAliases: HeaderAliases = {
  acronym: "short_name",
  committee_name: "name",
};

function normalizeHeader(value: string, aliases: HeaderAliases) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return aliases[normalized] ?? normalized;
}

function parseCsv(text: string, aliases: HeaderAliases = {}): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  const [headers = [], ...records] = rows.filter((record) =>
    record.some((value) => value.trim().length > 0),
  );
  const normalizedHeaders = headers.map((header) => normalizeHeader(header, aliases));
  return records.map((record) =>
    Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, (record[index] ?? "").trim()]),
    ),
  );
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCsvValue(row: CsvRow, key: string) {
  return row[key]?.trim() ?? "";
}

function csvError(rowNumber: number, message: string): never {
  fail(`CSV row ${rowNumber}: ${message}`);
}

export async function updateUserAccess(formData: FormData) {
  await assertTrustedOrigin();
  const actor = await requireAdmin();
  const parsed = z
    .object({
      id: postgresUuid,
      status: z.enum(["pending", "active", "suspended"]),
      global_role: z.enum(["admin", "dean", "staff", "faculty"]),
      person_category: z.enum(["faculty", "staff", "admin"]),
      department: z.string().trim().max(200),
      title: z.string().trim().max(200),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Invalid user access values.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      status: parsed.data.status,
      global_role: parsed.data.global_role,
      person_category: parsed.data.person_category,
      department: parsed.data.department || null,
      title: parsed.data.title || null,
    })
    .eq("id", parsed.data.id);
  if (error) fail(error.message);
  await audit(
    actor.id,
    "auth_user.access_updated",
    parsed.data.id,
    `${parsed.data.status} · ${parsed.data.global_role}`,
  );
  revalidatePath("/admin");
}

export async function inviteUser(formData: FormData) {
  await assertTrustedOrigin();
  const actor = await requireAdmin();
  const parsed = z
    .object({
      email: z.email().transform((value) => value.toLowerCase().trim()),
      full_name: z.string().trim().min(2).max(160),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Enter a valid name and email.");
  const env = getServerEnv();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name },
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });
  if (error) fail(error.message);
  await audit(actor.id, "auth_user.invited", data.user.id, parsed.data.email);
  redirect("/admin?message=Invitation sent.");
}

export async function importCommitteesCsv(formData: FormData) {
  await assertTrustedOrigin();
  const actor = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) fail("Choose a CSV file to import.");
  if (!file.name.toLowerCase().endsWith(".csv")) fail("Upload a .csv file.");
  if (file.size > 1_000_000) fail("CSV import is limited to 1 MB.");

  const rows = parseCsv(await file.text(), committeeHeaderAliases);
  if (!rows.length) fail("CSV file has no committee rows.");
  if (rows.length > 500) fail("CSV import is limited to 500 rows.");

  const supabase = await createClient();
  const committeesResult = await supabase.from("committees").select("id, name, short_name");
  if (committeesResult.error) fail(committeesResult.error.message);

  const committeesByName = new Map(
    (committeesResult.data ?? []).map((committee) => [normalizeKey(committee.name), committee]),
  );
  const committeesByShortName = new Map(
    (committeesResult.data ?? [])
      .filter((committee) => committee.short_name.trim())
      .map((committee) => [normalizeKey(committee.short_name), committee]),
  );
  const seenNames = new Set<string>();
  const seenShortNames = new Set<string>();
  let createdCount = 0;
  let updatedCount = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const name = normalizeCsvValue(row, "name");
    const shortName = normalizeCsvValue(row, "short_name").toUpperCase();
    const mandate = normalizeCsvValue(row, "mandate");
    const color = normalizeCsvValue(row, "color") || committeeColors[0].value;
    const status = normalizeCsvValue(row, "status").toLowerCase() || "active";
    if (name.length < 2 || name.length > 200) {
      csvError(rowNumber, "name must be between 2 and 200 characters.");
    }
    if (!shortName || shortName.length > 40) {
      csvError(rowNumber, "short_name/acronym is required and must be 40 characters or fewer.");
    }
    if (mandate.length > 10000) csvError(rowNumber, "mandate is too long.");
    if (seenNames.has(normalizeKey(name)))
      csvError(rowNumber, `duplicate committee name "${name}".`);
    if (seenShortNames.has(normalizeKey(shortName))) {
      csvError(rowNumber, `duplicate committee acronym "${shortName}".`);
    }

    const parsed = z
      .object({
        color: z.enum(committeeColors.map((committeeColor) => committeeColor.value)),
        status: z.enum(["active", "archived"]),
      })
      .safeParse({ color, status });
    if (!parsed.success) csvError(rowNumber, "color or status is invalid.");

    const existingByName = committeesByName.get(normalizeKey(name));
    const existingByShortName = committeesByShortName.get(normalizeKey(shortName));
    if (existingByName && existingByShortName && existingByName.id !== existingByShortName.id) {
      csvError(
        rowNumber,
        `name "${name}" and acronym "${shortName}" refer to different committees.`,
      );
    }
    const existingCommittee = existingByName ?? existingByShortName;

    if (existingCommittee) {
      const { error } = await supabase
        .from("committees")
        .update({
          name,
          short_name: shortName,
          mandate,
          color: parsed.data.color,
          status: parsed.data.status,
        })
        .eq("id", existingCommittee.id);
      if (error) csvError(rowNumber, error.message);
      committeesByName.set(normalizeKey(name), {
        ...existingCommittee,
        name,
        short_name: shortName,
      });
      committeesByShortName.set(normalizeKey(shortName), {
        ...existingCommittee,
        name,
        short_name: shortName,
      });
      updatedCount += 1;
    } else {
      const { data, error } = await supabase
        .from("committees")
        .insert({
          name,
          short_name: shortName,
          mandate,
          color: parsed.data.color,
          status: parsed.data.status,
          created_by: actor.id,
        })
        .select("id, name, short_name")
        .single();
      if (error) csvError(rowNumber, error.message);
      committeesByName.set(normalizeKey(data!.name), data!);
      committeesByShortName.set(normalizeKey(data!.short_name), data!);
      createdCount += 1;
    }
    seenNames.add(normalizeKey(name));
    seenShortNames.add(normalizeKey(shortName));
  }

  await audit(
    actor.id,
    "committees.csv_imported",
    null,
    `${createdCount} created, ${updatedCount} updated`,
    "committees",
  );
  revalidatePath("/admin");
  revalidatePath("/committees");
  revalidatePath("/dashboard");
  redirect(
    `/admin?message=${encodeURIComponent(
      `Committee CSV imported: ${createdCount} created, ${updatedCount} updated.`,
    )}`,
  );
}

export async function importPersonnelCsv(formData: FormData) {
  await assertTrustedOrigin();
  const actor = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) fail("Choose a CSV file to import.");
  if (!file.name.toLowerCase().endsWith(".csv")) fail("Upload a .csv file.");
  if (file.size > 1_000_000) fail("CSV import is limited to 1 MB.");

  const rows = parseCsv(await file.text(), personnelHeaderAliases);
  if (!rows.length) fail("CSV file has no personnel rows.");
  if (rows.length > 500) fail("CSV import is limited to 500 rows.");

  const admin = createAdminClient();
  const [profilesResult, committeesResult, rolesResult] = await Promise.all([
    admin.from("profiles").select("id, email, full_name"),
    admin.from("committees").select("id, name, short_name").eq("status", "active"),
    admin.from("committee_roles").select("id, name, access_level"),
  ]);
  if (profilesResult.error) fail(profilesResult.error.message);
  if (committeesResult.error) fail(committeesResult.error.message);
  if (rolesResult.error) fail(rolesResult.error.message);

  const profilesByEmail = new Map(
    (profilesResult.data ?? []).map((profile) => [normalizeKey(profile.email), profile]),
  );
  const committeesByReference = new Map<
    string,
    NonNullable<typeof committeesResult.data>[number]
  >();
  for (const committee of committeesResult.data ?? []) {
    committeesByReference.set(normalizeKey(committee.name), committee);
    if (committee.short_name.trim()) {
      committeesByReference.set(normalizeKey(committee.short_name), committee);
    }
  }
  const roles = rolesResult.data ?? [];
  const rolesByName = new Map(roles.map((role) => [normalizeKey(role.name), role]));
  const rolesByAccessLevel = new Map(
    ["chair", "staff", "member"].map((level) => [
      level,
      roles.filter((role) => role.access_level === level),
    ]),
  );
  const existingMembershipsResult = await admin
    .from("committee_members")
    .select("id, committee_id, profile_id");
  if (existingMembershipsResult.error) fail(existingMembershipsResult.error.message);
  const membershipIdsByPair = new Map(
    (existingMembershipsResult.data ?? []).map((membership) => [
      `${membership.committee_id}:${membership.profile_id}`,
      membership.id,
    ]),
  );

  const env = getServerEnv();
  let invitedCount = 0;
  let updatedCount = 0;
  let membershipCount = 0;
  const seenEmails = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const email = normalizeCsvValue(row, "email").toLowerCase();
    const fullName = normalizeCsvValue(row, "full_name");
    const committeeName = normalizeCsvValue(row, "committee");
    const roleName = normalizeCsvValue(row, "role");
    if (!email || !z.email().safeParse(email).success) csvError(rowNumber, "valid email required.");
    if (!fullName) csvError(rowNumber, "full_name is required.");
    if (!committeeName) csvError(rowNumber, "committee is required.");
    if (!roleName) csvError(rowNumber, "role is required.");

    const committee = committeesByReference.get(normalizeKey(committeeName));
    if (!committee) csvError(rowNumber, `committee "${committeeName}" was not found.`);
    const role =
      rolesByName.get(normalizeKey(roleName)) ??
      (rolesByAccessLevel.get(normalizeKey(roleName))?.length === 1
        ? rolesByAccessLevel.get(normalizeKey(roleName))![0]
        : undefined);
    if (!role) csvError(rowNumber, `role "${roleName}" was not found.`);

    const status = normalizeCsvValue(row, "status").toLowerCase() || "active";
    const globalRole = normalizeCsvValue(row, "global_role").toLowerCase() || "faculty";
    const personCategory =
      normalizeCsvValue(row, "person_category").toLowerCase() ||
      (globalRole === "admin" ? "admin" : globalRole === "staff" ? "staff" : "faculty");
    const access = z
      .object({
        status: z.enum(["pending", "active", "suspended"]),
        global_role: z.enum(["admin", "dean", "staff", "faculty"]),
        person_category: z.enum(["faculty", "staff", "admin"]),
      })
      .safeParse({ status, global_role: globalRole, person_category: personCategory });
    if (!access.success) csvError(rowNumber, "status, global_role, or person_category is invalid.");

    let profile = profilesByEmail.get(email);
    if (!profile) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
      });
      if (error) csvError(rowNumber, error.message);
      if (!data.user) csvError(rowNumber, "invitation did not return a user.");
      profile = { id: data.user.id, email, full_name: fullName };
      profilesByEmail.set(email, profile);
      invitedCount += 1;
    }

    if (!seenEmails.has(email)) {
      const { error } = await admin
        .from("profiles")
        .update({
          full_name: fullName,
          status: access.data.status,
          global_role: access.data.global_role,
          person_category: access.data.person_category,
          department: normalizeCsvValue(row, "department") || null,
          title: normalizeCsvValue(row, "title") || null,
        })
        .eq("id", profile.id);
      if (error) csvError(rowNumber, error.message);
      seenEmails.add(email);
      updatedCount += 1;
    }

    const pairKey = `${committee.id}:${profile.id}`;
    const existingMembershipId = membershipIdsByPair.get(pairKey);
    if (existingMembershipId) {
      const { error } = await admin
        .from("committee_members")
        .update({ role_id: role.id })
        .eq("id", existingMembershipId);
      if (error) csvError(rowNumber, error.message);
    } else {
      const { data, error } = await admin
        .from("committee_members")
        .insert({ committee_id: committee.id, profile_id: profile.id, role_id: role.id })
        .select("id")
        .single();
      if (error) csvError(rowNumber, error.message);
      membershipIdsByPair.set(pairKey, data!.id);
    }
    membershipCount += 1;
  }

  await audit(
    actor.id,
    "auth_user.personnel_csv_imported",
    null,
    `${updatedCount} profiles, ${membershipCount} memberships, ${invitedCount} invitations`,
  );
  revalidatePath("/admin");
  revalidatePath("/personnel");
  revalidatePath("/committees");
  redirect(
    `/admin?message=${encodeURIComponent(
      `CSV imported: ${updatedCount} profiles, ${membershipCount} memberships, ${invitedCount} invitations sent.`,
    )}`,
  );
}

export async function sendPasswordReset(formData: FormData) {
  await assertTrustedOrigin();
  const actor = await requireAdmin();
  const parsed = z
    .object({ id: postgresUuid, email: z.email() })
    .parse(Object.fromEntries(formData));
  const env = getServerEnv();
  const publicClient = createPublicClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const { error } = await publicClient.auth.resetPasswordForEmail(parsed.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });
  if (error) fail(error.message);
  await audit(actor.id, "auth_user.password_reset_requested", parsed.id, parsed.email);
  redirect("/admin?message=Password reset email sent.");
}

export async function deleteUser(formData: FormData) {
  await assertTrustedOrigin();
  const actor = await requireAdmin();
  const parsed = z
    .object({ id: postgresUuid, email: z.email() })
    .parse(Object.fromEntries(formData));
  if (parsed.id === actor.id) fail("You cannot delete your own administrator account.");
  const admin = createAdminClient();
  await audit(actor.id, "auth_user.deleted", parsed.id, parsed.email);
  const { error } = await admin.auth.admin.deleteUser(parsed.id, false);
  if (error) fail(error.message);
  revalidatePath("/admin");
}

export async function updateCommitteeStatus(formData: FormData) {
  await assertTrustedOrigin();
  await requireAdmin();
  const parsed = z
    .object({
      id: postgresUuid,
      name: z.string().trim().min(1),
      status: z.enum(["active", "archived"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Invalid committee status.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("committees")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) fail(error.message);
  revalidatePath("/admin");
  revalidatePath("/committees");
  revalidatePath("/dashboard");
  redirect(
    `/admin?message=${encodeURIComponent(
      `${parsed.data.name} ${parsed.data.status === "active" ? "restored" : "archived"}.`,
    )}`,
  );
}

export async function deleteCommittee(formData: FormData) {
  await assertTrustedOrigin();
  await requireAdmin();
  const parsed = z
    .object({
      id: postgresUuid,
      name: z.string().trim().min(1),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Invalid committee.");
  const supabase = await createClient();
  const { error } = await supabase.from("committees").delete().eq("id", parsed.data.id);
  if (error) fail(error.message);
  revalidatePath("/admin");
  revalidatePath("/committees");
  revalidatePath("/dashboard");
  revalidatePath("/personnel");
  redirect(`/admin?message=${encodeURIComponent(`${parsed.data.name} deleted.`)}`);
}
