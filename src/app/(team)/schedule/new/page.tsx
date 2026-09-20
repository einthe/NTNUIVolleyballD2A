import { redirect } from "next/navigation";
import { getRoster, getRoles, requireAccount } from "@/server/queries";
import { canManageEvent, eventTypes, type EventType } from "@/lib/domain";
import { BackLink, PageHeading } from "@/components/ui";
import { EventForm } from "@/components/event-form";
export default async function NewEvent() {
  const [profile, roles, players] = await Promise.all([requireAccount(), getRoles(), getRoster()]);
  const allowed = (Object.keys(eventTypes) as EventType[]).filter((type) =>
    canManageEvent(profile, roles, type),
  );
  if (!allowed.length) redirect("/schedule");
  return (
    <div className="narrow-page">
      <BackLink href="/schedule">Tilbake til terminlisten</BackLink>
      <PageHeading title="Ny hendelse" />
      <EventForm allowed={allowed} players={players.filter((p) => p.base_role === "player")} />
    </div>
  );
}
