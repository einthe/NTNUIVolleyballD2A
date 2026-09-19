import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Pencil, Volleyball } from "lucide-react";
import { getEvent, getLineup, getRoles, getRoster, requireAccount } from "@/server/queries";
import { canCoach, canManageEvent, eventTypes, eventTone, uuid } from "@/lib/domain";
import { dateLabel } from "@/lib/dates";
import { BackLink, Badge } from "@/components/ui";
import { homeAway } from "@/components/events";
import { Court } from "@/components/court";
import { DeleteButton } from "@/components/forms";
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [event, profile, roles] = await Promise.all([getEvent(id), requireAccount(), getRoles()]);
  if (!event) notFound();
  const editable = canManageEvent(profile, roles, event.event_type, event.created_by_user_id);
  const lineup = event.event_type === "match" ? await getLineup(id) : null;
  const revision = lineup?.lineup_revisions.find((r) => r.is_current_published);
  const hasDraft = lineup?.lineup_revisions.some(
    (r) => r.status === "draft" && (!revision || r.revision_number > revision.revision_number),
  );
  const roster = event.event_type === "volunteer_work" ? await getRoster() : [];
  return (
    <div className="narrow-page">
      <BackLink href="/schedule">Tilbake til terminlisten</BackLink>
      <article className="card event-detail">
        <div className="event-labels">
          <Badge tone={eventTone[event.event_type]}>{eventTypes[event.event_type]}</Badge>
          {event.match_details && (
            <span className="muted">{homeAway[event.match_details.home_away]}</span>
          )}
        </div>
        <h1>{event.title}</h1>
        <div className="event-detail-meta">
          <span>
            <CalendarDays size={19} />
            {dateLabel(event.starts_at)}
            {event.ends_at && ` – ${dateLabel(event.ends_at, "HH:mm")}`}
          </span>
          {event.location && (
            <span>
              <MapPin size={19} />
              {event.location}
            </span>
          )}
        </div>
        {event.match_details && (
          <div className="match-banner">
            <div>
              <span className="eyebrow">NTNUI</span>
              <strong>D2A</strong>
            </div>
            <span className="score">
              {event.match_details.team_sets !== null
                ? `${event.match_details.team_sets} – ${event.match_details.opponent_sets}`
                : "VS"}
            </span>
            <div>
              <span className="eyebrow">MOTSTANDER</span>
              <strong>{event.match_details.opponent}</strong>
            </div>
          </div>
        )}
        {event.description && <p className="post-body">{event.description}</p>}
        {event.event_type === "volunteer_work" && (
          <section className="assignments">
            <h2>Satt opp på dugnad</h2>
            {event.volunteer_assignments?.length ? (
              <ul>
                {event.volunteer_assignments.map((a) => (
                  <li key={a.player_user_id}>
                    {roster.find((p) => p.id === a.player_user_id)?.full_name ??
                      "Tidligere lagmedlem"}
                    {a.player_user_id === profile.id && <Badge>Deg</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Ingen spillere er tildelt ennå.</p>
            )}
          </section>
        )}
        {editable && (
          <div className="editor-footer">
            <Link className="button secondary" href={`/schedule/${id}/edit`}>
              <Pencil size={15} /> Rediger hendelse
            </Link>
            <DeleteButton action="delete-event" id={id} label="Slett hendelse" />
          </div>
        )}
      </article>
      {event.event_type === "match" && (
        <section className="card match-lineup">
          <div className="section-title">
            <h2>
              <Volleyball size={20} /> Kampoppstilling
            </h2>
            {canCoach(profile) && (
              <Link className="button secondary" href={`/schedule/${id}/lineup`}>
                {hasDraft ? "Fortsett utkast" : revision ? "Ny versjon" : "Lag kampoppstilling"}
              </Link>
            )}
          </div>
          {revision ? (
            <>
              <p className="muted">
                Versjon {revision.revision_number} · Publisert {dateLabel(revision.published_at!)}
              </p>
              <Court slots={revision.lineup_revision_slots} />
              {lineup &&
                lineup.lineup_revisions.filter(
                  (r) => r.status === "published" && !r.is_current_published,
                ).length > 0 && (
                  <details className="revision-history">
                    <summary>Tidligere publiserte versjoner</summary>
                    {lineup.lineup_revisions
                      .filter((r) => r.status === "published" && !r.is_current_published)
                      .sort((a, b) => b.revision_number - a.revision_number)
                      .map((r) => (
                        <div key={r.id}>
                          <h3>Versjon {r.revision_number}</h3>
                          <p className="muted">{dateLabel(r.published_at!)}</p>
                          <Court slots={r.lineup_revision_slots} />
                        </div>
                      ))}
                  </details>
                )}
            </>
          ) : (
            <p className="aside-empty">
              {hasDraft
                ? "Et utkast er lagret. Det er bare synlig for trenere og administrator."
                : "Oppstillingen er ikke publisert ennå."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
