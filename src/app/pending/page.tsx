import { Clock3 } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name")
    .eq("id", user.id)
    .single();
  if (profile?.status === "active") redirect("/dashboard");
  if (profile?.status === "suspended") redirect("/suspended");
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <Clock3 className="mx-auto size-12 text-indigo-600" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Approval pending</h1>
        <p className="mt-2 text-slate-500">
          Thanks, {profile?.full_name ?? "there"}. Your email is confirmed. An administrator must
          approve your portal access and role.
        </p>
        <form action={signOut} className="mt-6">
          <button className={buttonClass}>Sign out</button>
        </form>
      </section>
    </main>
  );
}
