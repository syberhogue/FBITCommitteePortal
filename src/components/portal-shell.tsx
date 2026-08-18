import Link from "next/link";
import { BarChart3, Landmark, LayoutDashboard, Settings, ShieldCheck, Users } from "lucide-react";
import type { Profile } from "@/types/database";
import { GlobalSearch } from "@/components/global-search";
import { signOut } from "@/app/(auth)/actions";
import { initials } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/committees", label: "Committees", icon: BarChart3 },
  { href: "/personnel", label: "Personnel", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function PortalShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-t-4 border-[#E75D2A] bg-[#003C71] text-white shadow-lg">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-3 lg:px-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-bold">
            <Landmark className="size-7" aria-hidden />
            <span className="hidden xl:inline">FBIT Committee Portal</span>
          </Link>
          <div className="flex-1">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right lg:block">
              <p className="text-xs font-semibold">{profile.full_name}</p>
              <p className="text-[10px] uppercase text-sky-100">{profile.global_role}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-[#00283C] text-xs font-bold">
              {initials(profile.full_name)}
            </span>
            <form action={signOut}>
              <button className="rounded-md px-2 py-1 text-xs text-sky-100 hover:bg-[#005793] hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          className="mx-auto flex max-w-screen-2xl gap-1 overflow-x-auto px-4 pb-2 lg:px-8"
          aria-label="Primary"
        >
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-[#005793]"
            >
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
          {profile.global_role === "admin" && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-[#005793]"
            >
              <ShieldCheck className="size-4" aria-hidden /> Admin
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-screen-2xl space-y-7 px-4 py-8 lg:px-8">{children}</main>
    </div>
  );
}
