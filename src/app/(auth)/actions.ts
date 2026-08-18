"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";

const credentialsSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(12),
});

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signIn(formData: FormData) {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    fail("/signin", "Enter a valid email and a password of at least 12 characters.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) fail("/signin", "The email or password is incorrect.");

  const { data: profile } = await supabase.from("profiles").select("status").single();
  if (profile?.status === "pending") redirect("/pending");
  if (profile?.status === "suspended") redirect("/suspended");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const parsed = credentialsSchema
    .extend({ full_name: z.string().trim().min(2).max(160), confirm_password: z.string() })
    .refine((data) => data.password === data.confirm_password, {
      message: "Passwords do not match.",
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("/signup", parsed.error.issues[0]?.message ?? "Check the form values.");

  const supabase = await createClient();
  const env = getPublicEnv();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/pending`,
    },
  });
  if (error) fail("/signup", error.message);
  redirect("/signup?sent=1");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = z.object({ email: z.email() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("/forgot-password", "Enter a valid email address.");
  const supabase = await createClient();
  const env = getPublicEnv();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });
  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const parsed = z
    .object({ password: z.string().min(12), confirm_password: z.string() })
    .refine((data) => data.password === data.confirm_password, {
      message: "Passwords do not match.",
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    fail("/reset-password", parsed.error.issues[0]?.message ?? "Invalid password.");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) fail("/reset-password", error.message);
  redirect("/signin?message=Password updated. You can now sign in.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/signin");
}
