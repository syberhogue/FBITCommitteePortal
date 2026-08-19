import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data as Profile | null;
});

export async function requireActiveProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");
  if (profile.status === "pending") redirect("/pending");
  if (profile.status === "suspended") redirect("/suspended");
  return profile;
}

export async function requireAdmin() {
  const profile = await requireActiveProfile();
  if (profile.global_role !== "admin") redirect("/dashboard?error=Administrator access required.");
  return profile;
}

export async function requireSettingsAccess() {
  const profile = await requireActiveProfile();
  if (!(await hasSettingsAccess(profile))) {
    redirect("/dashboard?error=Settings access is not available to members.");
  }
  return profile;
}

export async function hasSettingsAccess(profile: Profile) {
  if (profile.global_role !== "faculty") return true;
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("committee_members")
    .select("role_id")
    .eq("profile_id", profile.id);
  const roleIds = [...new Set((memberships ?? []).map((membership) => membership.role_id))];
  if (!roleIds.length) return false;
  const { data: elevatedRoles } = await supabase
    .from("committee_roles")
    .select("id")
    .in("id", roleIds)
    .in("access_level", ["chair", "staff"]);
  return Boolean(elevatedRoles?.length);
}

export function canManageAllCommittees(profile: Profile) {
  return profile.global_role === "admin" || profile.global_role === "dean";
}
