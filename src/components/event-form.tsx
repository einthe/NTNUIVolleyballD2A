"use client";
import Link from "next/link";
import { useState } from "react";
import { eventTypes, type EventType, type Player, type TeamEvent } from "@/lib/domain";
import { localInput } from "@/lib/dates";
import { ActionForm, Submit } from "./forms";
export function EventForm({
  event: initialEvent,
  allowed,
  players,
}: {
  event?: TeamEvent;
  allowed: EventType[];
  players: Player[];
}) {
  const [event] = useState(initialEvent);
  const [kind, setKind] = useState<EventType>(event?.event_type ?? allowed[0]);
  return (
    <ActionForm className="card editor form-stack">
      <input type="hidden" name="action" value="event" />
      {event && (
        <>
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="expected_updated_at" value={event.updated_at} />
        </>
      )}
      <label>
        Type hendelse
        {event ? (
          <>
            <input value={eventTypes[event.event_type]} disabled />
            <input type="hidden" name="event_type" value={event.event_type} />
          </>
        ) : (
          <select
            name="event_type"
            value={kind}
            onChange={(e) => setKind(e.target.value as EventType)}
          >
            {allowed.map((k) => (
              <option key={k} value={k}>
                {eventTypes[k]}
              </option>
            ))}
          </select>
        )}
      </label>
      <label>
        Tittel
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={event?.title}
          placeholder="Gi hendelsen en tydelig tittel"
        />
      </label>
      <div className="form-grid">
        <label>
          Starter
          <input
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={event && localInput(event.starts_at)}
          />
        </label>
        <label>
          Slutter <span className="muted">(valgfritt)</span>
          <input
            name="ends_at"
            type="datetime-local"
            defaultValue={event?.ends_at ? localInput(event.ends_at) : undefined}
          />
        </label>
      </div>
      <p className="field-hint">Alle tidspunkt er i norsk tid (Europe/Oslo).</p>
      <label>
        Sted
        <input
          name="location"
          maxLength={200}
          defaultValue={event?.location ?? ""}
          placeholder="Hall, adresse eller møtested"
        />
      </label>
      {kind === "match" && (
        <fieldset>
          <legend>Kampinformasjon</legend>
          <div className="form-grid">
            <label>
              Motstander
              <input
                name="opponent"
                maxLength={100}
                required
                defaultValue={event?.match_details?.opponent}
              />
            </label>
            <label>
              Hjemme / borte
              <select name="home_away" defaultValue={event?.match_details?.home_away ?? "home"}>
                <option value="home">Hjemmekamp</option>
                <option value="away">Bortekamp</option>
                <option value="neutral">Nøytral bane</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Sett vunnet · NTNUI
              <input
                name="team_sets"
                type="number"
                min={0}
                max={3}
                defaultValue={event?.match_details?.team_sets ?? ""}
              />
            </label>
            <label>
              Sett vunnet · motstander
              <input
                name="opponent_sets"
                type="number"
                min={0}
                max={3}
                defaultValue={event?.match_details?.opponent_sets ?? ""}
              />
            </label>
          </div>
          <p className="field-hint">La begge resultatfeltene stå tomme til kampen er i gang.</p>
        </fieldset>
      )}
      <label>
        Beskrivelse
        <textarea
          name="description"
          maxLength={10000}
          rows={5}
          defaultValue={event?.description ?? ""}
          placeholder="Det laget trenger å vite …"
        />
      </label>
      {kind === "volunteer_work" && (
        <fieldset>
          <legend>Spillere som er satt opp på dugnad</legend>
          <p className="field-hint">
            Dette er oppgavefordeling. Påmelding og oppmøte håndteres i Spond.
          </p>
          <div className="checkbox-grid">
            {players.map((player) => (
              <label className="checkbox-label" key={player.id}>
                <input
                  type="checkbox"
                  name="assignments"
                  value={player.id}
                  defaultChecked={event?.volunteer_assignments?.some(
                    (a) => a.player_user_id === player.id,
                  )}
                />
                {player.full_name}
              </label>
            ))}
          </div>
          {!players.length && <p className="muted">Ingen godkjente spillere ennå.</p>}
        </fieldset>
      )}
      <div className="editor-footer">
        <Link className="button secondary" href={event ? `/schedule/${event.id}` : "/schedule"}>
          Avbryt
        </Link>
        <Submit>{event ? "Lagre endringer" : "Opprett hendelse"}</Submit>
      </div>
    </ActionForm>
  );
}
