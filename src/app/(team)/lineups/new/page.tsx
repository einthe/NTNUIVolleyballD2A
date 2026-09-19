import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Volleyball } from "lucide-react";
import { getEvents, requireAccount } from "@/server/queries";
import { canCoach } from "@/lib/domain";
import { BackLink, EmptyState, PageHeading, Pagination, pageNumber } from "@/components/ui";
import { EventCard } from "@/components/events";

export const metadata = { title: "Ny kampoppstilling" };
export default async function ChooseLineupMatch({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; history?: string }>;
}) {
  const profile = await requireAccount();
  if (!canCoach(profile)) redirect("/feed");
  const params = await searchParams;
  const page = pageNumber(params.page);
  const past = params.history === "1";
  const { events, count } = await getEvents(past, "match", page);
  return (
    <div className="narrow-page">
      <BackLink href="/feed">Tilbake til innlegg</BackLink>
      <PageHeading
        eyebrow="SETT LAGET"
        title="Ny kampoppstilling"
        description="Velg kampen, sett opp spillerne og publiser oppstillingen i lagets feed."
      >
        <Link className="button secondary" href="/schedule/new">
          <Plus size={16} /> Opprett kamp
        </Link>
      </PageHeading>
      <nav className="filter-tabs" aria-label="Velg kamper">
        <Link className={!past ? "selected" : ""} href="/lineups/new">
          Kommende kamper
        </Link>
        <Link className={past ? "selected" : ""} href="/lineups/new?history=1">
          Tidligere kamper
        </Link>
      </nav>
      <div className="event-list">
        {events.map((event) => (
          <EventCard key={event.id} event={event} href={`/schedule/${event.id}/lineup`} />
        ))}
      </div>
      {!events.length && (
        <div className="card">
          <EmptyState icon={<Volleyball size={28} />} title="Ingen kamper å velge mellom">
            <p>
              Opprett først en kamp i terminlisten. Deretter kan du velge seks spillere og en
              eventuell libero.
            </p>
            <Link className="button" href="/schedule/new">
              Opprett kamp
            </Link>
          </EmptyState>
        </div>
      )}
      <Pagination
        page={page}
        count={count}
        size={24}
        href={`/lineups/new?history=${past ? "1" : "0"}`}
      />
    </div>
  );
}
