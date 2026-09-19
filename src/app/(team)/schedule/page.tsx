import Link from "next/link";
import { Plus, CalendarDays, Volleyball } from "lucide-react";
import { getEvents, getRoles, requireAccount } from "@/server/queries";
import { canCoach, canManageEvent, eventTypes, type EventType } from "@/lib/domain";
import { dateLabel } from "@/lib/dates";
import { EmptyState, PageHeading, Pagination, pageNumber } from "@/components/ui";
import { EventCard } from "@/components/events";
export const metadata = { title: "Terminliste" };
export default async function Schedule({
  searchParams,
}: {
  searchParams: Promise<{ history?: string; type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const past = params.history === "1";
  const kind = params.type && Object.hasOwn(eventTypes, params.type) ? params.type : undefined;
  const page = pageNumber(params.page);
  const [profile, roles, { events, count }] = await Promise.all([
    requireAccount(),
    getRoles(),
    getEvents(past, kind, page),
  ]);
  const canCreate = (Object.keys(eventTypes) as EventType[]).some((type) =>
    canManageEvent(profile, roles, type),
  );
  const groups = Object.groupBy(events, (event) => dateLabel(event.starts_at, "MMMM yyyy"));
  return (
    <>
      <PageHeading
        eyebrow="VI SES PÅ BANEN"
        title="Terminliste"
        description="Treninger, kamper og alt det andre vi gjør sammen."
      >
        <div className="button-row">
          {canCoach(profile) && (
            <Link href="/lineups/new" className="button secondary">
              <Volleyball size={18} /> Kampoppstilling
            </Link>
          )}
          {canCreate && (
            <Link href="/schedule/new" className="button">
              <Plus size={18} /> Ny hendelse
            </Link>
          )}
        </div>
      </PageHeading>
      <div className="schedule-toolbar">
        <nav className="filter-tabs" aria-label="Tidsperiode">
          <Link
            className={!past ? "selected" : ""}
            href={`/schedule${kind ? `?type=${kind}` : ""}`}
          >
            Kommende
          </Link>
          <Link
            className={past ? "selected" : ""}
            href={`/schedule?history=1${kind ? `&type=${kind}` : ""}`}
          >
            Tidligere
          </Link>
        </nav>
        <form className="inline-filter">
          <input type="hidden" name="history" value={past ? "1" : "0"} />
          <label className="sr-only" htmlFor="event-filter">
            Type hendelse
          </label>
          <select id="event-filter" name="type" defaultValue={kind ?? ""}>
            <option value="">Alle hendelser</option>
            {Object.entries(eventTypes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button className="button secondary">Vis</button>
        </form>
      </div>
      {Object.entries(groups).map(([month, entries]) => (
        <section className="schedule-month" key={month}>
          <h2 className="month-label">
            {month} <span>{entries?.length}</span>
          </h2>
          <div className="event-list">
            {entries?.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
      {!events.length && (
        <div className="card">
          <EmptyState
            icon={<CalendarDays size={28} />}
            title={past ? "Ingen tidligere hendelser" : "Plass til nye opplevelser"}
          >
            <p>
              {past
                ? "Avsluttede hendelser bevares og vises her."
                : "Når noe blir lagt i terminlisten, finner du det her."}
            </p>
            {canCreate && (
              <Link className="button secondary" href="/schedule/new">
                Opprett en hendelse
              </Link>
            )}
          </EmptyState>
        </div>
      )}
      <Pagination
        page={page}
        count={count}
        size={24}
        href={`/schedule?history=${past ? 1 : 0}${kind ? `&type=${kind}` : ""}`}
      />
    </>
  );
}
