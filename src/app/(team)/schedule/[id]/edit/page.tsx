import { notFound, redirect } from "next/navigation";
import { getEvent, getRoles, getRoster, requireAccount } from "@/server/queries";
import { canManageEvent, uuid } from "@/lib/domain";
import { BackLink, PageHeading } from "@/components/ui";
import { EventForm } from "@/components/event-form";
export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [event, profile, roles, roster] = await Promise.all([
    getEvent(id),
    requireAccount(),
    getRoles(),
    getRoster(),
  ]);
  if (!event) notFound();
  if (!canManageEvent(profile, roles, event.event_type, event.created_by_user_id))
    redirect(`/schedule/${id}`);
  return (
    <div className="narrow-page">
      <BackLink href={`/schedule/${id}`}>Tilbake til hendelsen</BackLink>
      <PageHeading eyebrow="HOLD LAGET OPPDATERT" title="Rediger hendelse" />
      <EventForm
        event={event}
        allowed={[event.event_type]}
        players={roster.filter((p) => p.base_role === "player")}
      />
    </div>
  );
}
