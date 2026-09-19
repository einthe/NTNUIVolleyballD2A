"use client";
import { useState } from "react";
import { secondaryRoles, type Player, type Profile } from "@/lib/domain";
import { ActionForm, Submit } from "./forms";
export function AdminUserForm({
  user,
  player,
}: {
  user: Profile & { email: string };
  player?: Player;
}) {
  const [role, setRole] = useState(user.base_role ?? "player");
  return (
    <ActionForm>
      <input type="hidden" name="action" value="user" />
      <input type="hidden" name="id" value={user.id} />
      <div className="form-grid">
        <label>
          Fullt navn
          <input
            name="full_name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={user.full_name}
          />
        </label>
        <label>
          Grunnrolle
          <select
            name="base_role"
            value={role}
            onChange={(e) => setRole(e.target.value as "player" | "coach")}
          >
            <option value="player">Spiller</option>
            <option value="coach">Trener</option>
          </select>
        </label>
      </div>
      {role === "coach" && user.base_role === "player" && (
        <p className="message info">
          Når du endrer til trener, fjernes ansvarsroller, draktnummer og spillerposisjoner.
          Historiske innlegg og oppstillinger bevares.
        </p>
      )}
      <div className="form-grid">
        <label>
          Kontostatus
          <select
            name="account_status"
            defaultValue={user.account_status === "pending" ? "approved" : user.account_status}
          >
            <option value="approved">Godkjent</option>
            <option value="rejected">Avvist</option>
            <option value="disabled">Deaktivert</option>
          </select>
        </label>
        {role === "player" && (
          <label>
            Draktnummer
            <input
              type="number"
              name="jersey_number"
              min={0}
              max={99}
              defaultValue={player?.player_profiles?.jersey_number ?? ""}
              placeholder="Ikke tildelt"
            />
          </label>
        )}
      </div>
      {role === "player" && (
        <fieldset>
          <legend>Ansvarsroller</legend>
          <div className="checkbox-grid">
            {Object.entries(secondaryRoles).map(([key, label]) => (
              <label className="checkbox-label" key={key}>
                <input
                  type="checkbox"
                  name="roles"
                  value={key}
                  defaultChecked={player?.player_secondary_roles.some((r) => r.role_key === key)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Submit>
        {user.account_status === "pending" ? "Behandle forespørsel" : "Lagre endringer"}
      </Submit>
    </ActionForm>
  );
}
