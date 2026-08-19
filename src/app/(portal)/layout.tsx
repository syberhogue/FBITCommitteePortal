import { hasSettingsAccess, requireActiveProfile } from "@/lib/auth";
import { PortalShell } from "@/components/portal-shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireActiveProfile();
  const canAccessSettings = await hasSettingsAccess(profile);
  return (
    <PortalShell profile={profile} canAccessSettings={canAccessSettings}>
      {children}
    </PortalShell>
  );
}
