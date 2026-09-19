import { notFound, redirect } from "next/navigation";
import { getEvent, getLineup, getRoster, requireAccount } from "@/server/queries";
import { canCoach, uuid } from "@/lib/domain";
import { BackLink, PageHeading } from "@/components/ui";
import { LineupEditor } from "@/components/lineup-editor";
export default async function EditLineup({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const profile = await requireAccount();
  if (!canCoach(profile)) redirect(`/schedule/${id}`);
  const [event, lineup, roster] = await Promise.all([getEvent(id), getLineup(id), getRoster()]);
  if (!event || event.event_type !== "match") notFound();
  const revisions = (lineup?.lineup_revisions ?? []).sort(
    (a, b) => b.revision_number - a.revision_number,
  );
  return (
    <>
      <BackLink href={`/schedule/${id}`}>Tilbake til kampen</BackLink>
      <PageHeading
        eyebrow="SEKS PÅ BANEN. HELE LAGET I RYGGEN."
        title="Kampoppstilling"
        description={event.title}
      />
      <LineupEditor
        matchId={id}
        players={roster.filter((p) => p.base_role === "player")}
        revision={revisions[0]}
        version={revisions[0]?.revision_number ?? 0}
      />
    </>
  );
}
