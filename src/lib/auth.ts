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

export function canManageAllCommittees(profile: Profile) {
  return profile.global_role === "admin" || profile.global_role === "dean";
}
