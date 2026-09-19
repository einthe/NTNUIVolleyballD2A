import { Shell } from "@/components/shell";
import { getNotifications, requireAccount } from "@/server/queries";
export const dynamic = "force-dynamic";
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAccount();
  const notifications = await getNotifications();
  return (
    <Shell profile={profile} notifications={notifications}>
      {children}
    </Shell>
  );
}
