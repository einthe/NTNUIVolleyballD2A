import { Shell } from "@/components/shell";
import { TeamProvider } from "@/components/team-provider";
import { getRoles, requireAccount } from "@/server/queries";
import { accessScope } from "@/lib/cache/contract";
export const dynamic = "force-dynamic";
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAccount();
  const roles = await getRoles(profile);
  const scope = accessScope(profile, roles);
  return (
    <TeamProvider
      key={scope}
      initial={{
        profile,
        roles,
        scope,
        imageLimitMB: Math.min(10, Math.max(1, Number(process.env.MAX_IMAGE_SIZE_MB) || 3)),
      }}
    >
      <Shell>{children}</Shell>
    </TeamProvider>
  );
}
