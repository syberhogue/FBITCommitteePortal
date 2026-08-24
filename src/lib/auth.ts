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

export function normalizedGlobalRole(profile: Pick<Profile, "global_role">) {
  return profile.global_role.trim().toLowerCase();
}

export function isAdminProfile(profile: Pick<Profile, "global_role">) {
  return normalizedGlobalRole(profile) === "admin";
}

export function isDeanProfile(profile: Pick<Profile, "global_role">) {
  return normalizedGlobalRole(profile) === "dean" || normalizedGlobalRole(profile) === "ad";
}

export async function requireAdmin() {
  const profile = await requireActiveProfile();
  if (!isAdminProfile(profile)) redirect("/dashboard?error=Administrator access required.");
  return profile;
}

export async function requireSettingsAccess() {
  return requireAdmin();
}

export async function hasSettingsAccess(profile: Profile) {
  return isAdminProfile(profile);
}

export function canManageAllCommittees(profile: Profile) {
  return isAdminProfile(profile) || isDeanProfile(profile);
}
