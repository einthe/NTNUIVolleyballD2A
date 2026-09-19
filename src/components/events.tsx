import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { eventTone, eventTypes, type TeamEvent } from "@/lib/domain";
import { dateLabel } from "@/lib/dates";
import { Badge } from "./ui";
export const homeAway = { home: "Hjemmekamp", away: "Bortekamp", neutral: "Nøytral bane" };
export function EventCard({ event, href }: { event: TeamEvent; href?: string }) {
  return (
    <Link className="event-card card" href={href ?? `/schedule/${event.id}`}>
      <div className="event-date">
        <span>{dateLabel(event.starts_at, "MMM")}</span>
        <strong>{dateLabel(event.starts_at, "dd")}</strong>
        <small>{dateLabel(event.starts_at, "EEE")}</small>
      </div>
      <div className="event-card-content">
        <div className="event-labels">
          <Badge tone={eventTone[event.event_type]}>{eventTypes[event.event_type]}</Badge>
          {event.match_details && (
            <span className="muted">{homeAway[event.match_details.home_away]}</span>
          )}
        </div>
        <h2>{event.title}</h2>
        <div className="event-meta">
          <span>
            <CalendarDays size={14} />
            {dateLabel(event.starts_at, "HH:mm")}
            {event.ends_at && `–${dateLabel(event.ends_at, "HH:mm")}`}
          </span>
          {event.location && (
            <span>
              <MapPin size={14} />
              {event.location}
            </span>
          )}
        </div>
      </div>
      {event.match_details?.team_sets !== null && event.match_details?.team_sets !== undefined ? (
        <strong className="match-score">
          {event.match_details.team_sets} – {event.match_details.opponent_sets}
        </strong>
      ) : (
        <ArrowUpRight size={19} className="event-arrow" />
      )}
    </Link>
  );
}
export function SmallEvent({ event }: { event: TeamEvent }) {
  return (
    <Link href={`/schedule/${event.id}`} className="small-event">
      <div className="small-event-date">
        <strong>{dateLabel(event.starts_at, "dd")}</strong>
        <span>{dateLabel(event.starts_at, "MMM")}</span>
      </div>
      <div>
        <span className={`event-type-text tone-${eventTone[event.event_type]}`}>
          {eventTypes[event.event_type]}
        </span>
        <strong>{event.title}</strong>
        <small>
          {dateLabel(event.starts_at, "EEE HH:mm")} {event.location && `· ${event.location}`}
        </small>
      </div>
    </Link>
  );
}
