"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { z } from "zod";
import { postgresUuid } from "@/lib/validation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
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

async function audit(actorId: string, eventType: string, entityId: string | null, label: string) {
  const admin = createAdminClient();
  await admin.from("activity_log").insert({
    actor_id: actorId,
    event_type: eventType,
    entity_type: "auth_user",
    entity_id: entityId,
    details: { label },
  });
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
