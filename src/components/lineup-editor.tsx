"use client";
import { useState } from "react";
import type { Player, Revision, Slot } from "@/lib/domain";
import { ActionForm, Submit } from "./forms";
import { Court } from "./court";
export function LineupEditor({
  matchId,
  players,
  revision,
  version,
}: {
  matchId: string;
  players: Player[];
  revision?: Revision;
  version: number;
}) {
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (revision?.lineup_revision_slots ?? []).map((s) => [
        s.is_libero ? "libero" : `slot_${s.court_position}`,
        s.player_user_id,
      ]),
    ),
  );
  const slots: Slot[] = Object.entries(selection)
    .filter(([, id]) => id)
    .flatMap(([key, id]) => {
      const player = players.find((p) => p.id === id);
      if (!player) return [];
      return [
        {
          player_user_id: id,
          court_position: key === "libero" ? null : Number(key.split("_")[1]),
          is_libero: key === "libero",
          full_name_snapshot: player.full_name,
          jersey_number_snapshot: player.player_profiles?.jersey_number ?? null,
          primary_position_snapshot:
            player.player_positions.find((p) => p.is_primary)?.position_key ?? null,
        },
      ];
    });
  return (
    <div className="lineup-editor-grid">
      <ActionForm className="card editor form-stack">
        <input type="hidden" name="action" value="lineup" />
        <input type="hidden" name="match_id" value={matchId} />
        <input type="hidden" name="expected_revision" value={version} />
        <div>
          <h2>Sett startsekseren</h2>
          <p className="muted">
            Velg en spiller i hver rotasjonsposisjon. Lagre et utkast, eller publiser til laget.
          </p>
        </div>
        <div className="form-grid">
          {[4, 3, 2, 5, 6, 1].map((position) => (
            <label key={position}>
              <span id={`slot-label-${position}`}>Posisjon {position}</span>
              <select
                aria-labelledby={`slot-label-${position}`}
                name={`slot_${position}`}
                value={selection[`slot_${position}`] ?? ""}
                onChange={(e) =>
                  setSelection({ ...selection, [`slot_${position}`]: e.target.value })
                }
              >
                <option value="">Velg spiller</option>
                {players.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={Object.entries(selection).some(
                      ([key, id]) => key !== `slot_${position}` && id === p.id,
                    )}
                  >
                    {p.player_profiles?.jersey_number !== null &&
                    p.player_profiles?.jersey_number !== undefined
                      ? `#${p.player_profiles.jersey_number} `
                      : ""}
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label>
          Libero <span className="muted">(valgfritt)</span>
          <select
            name="libero"
            value={selection.libero ?? ""}
            onChange={(e) => setSelection({ ...selection, libero: e.target.value })}
          >
            <option value="">Ingen libero</option>
            {players.map((p) => (
              <option
                key={p.id}
                value={p.id}
                disabled={Object.entries(selection).some(
                  ([key, id]) => key !== "libero" && id === p.id,
                )}
              >
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <p className="field-hint">
          Publisering lagrer navn, draktnummer og spillerposisjon slik de er nå. Tidligere
          publiserte versjoner bevares.
        </p>
        <div className="button-row">
          <Submit secondary name="intent" value="draft">
            Lagre utkast
          </Submit>
          <Submit name="intent" value="publish">
            Publiser oppstilling
          </Submit>
        </div>
      </ActionForm>
      <section className="card lineup-preview">
        <h2>Forhåndsvisning</h2>
        <Court slots={slots} />
      </section>
    </div>
  );
}
