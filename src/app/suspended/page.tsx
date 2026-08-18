import { Ban } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { buttonClass } from "@/components/ui";

export default function SuspendedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <section className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl">
        <Ban className="mx-auto size-12 text-red-600" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Account suspended</h1>
        <p className="mt-2 text-slate-500">
          Your account cannot access portal data. Contact your university portal administrator for
          assistance.
        </p>
        <form action={signOut} className="mt-6">
          <button className={buttonClass}>Sign out</button>
        </form>
      </section>
    </main>
  );
}
