import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/queries";
import { dateLabel } from "@/lib/dates";
import type { Player, Profile } from "@/lib/domain";
import { Avatar, Badge, EmptyState, PageHeading } from "@/components/ui";
import { AdminUserForm } from "@/components/admin-user-form";
import { PositionForm } from "@/components/roster";
const statuses = {
  pending: "Venter på godkjenning",
  approved: "Godkjent",
  rejected: "Avvist",
  disabled: "Deaktivert",
};
export default async function AdminUsers() {
  await requireAdmin();
  const db = await createClient();
  const [usersResult, playersResult] = await Promise.all([
    db.rpc("admin_users"),
    db
      .from("profiles")
      .select(
        "id,full_name,base_role,account_status,created_at,player_profiles(jersey_number),player_positions:player_positions!player_positions_player_user_id_fkey(position_key,is_primary),player_secondary_roles:player_secondary_roles!player_secondary_roles_player_user_id_fkey(role_key)",
      )
      .neq("base_role", "admin"),
  ]);
  if (usersResult.error || playersResult.error) throw new Error("Kunne ikke hente brukere.");
  const users = usersResult.data as (Profile & { email: string })[];
  const players = playersResult.data as unknown as Player[];
  return (
    <>
      <PageHeading
        eyebrow="ET TRYGT LAGROM"
        title="Brukere og tilganger"
        description="Godkjenn nye medlemmer og fordel ansvar i laget."
      />
      <div className="admin-stats">
        <div className="card">
          <strong>{users.filter((u) => u.account_status === "pending").length}</strong>
          <span>venter på godkjenning</span>
        </div>
        <div className="card">
          <strong>{users.filter((u) => u.account_status === "approved").length}</strong>
          <span>godkjente medlemmer</span>
        </div>
      </div>
      {!users.length && (
        <EmptyState title="Ingen forespørsler ennå">
          <p>Nye registreringer dukker opp her.</p>
        </EmptyState>
      )}
      <div className="admin-users">
        {[...users]
          .sort(
            (a, b) =>
              Number(b.account_status === "pending") - Number(a.account_status === "pending"),
          )
          .map((user) => {
            const player = players.find((p) => p.id === user.id);
            return (
              <details className="card admin-user" key={user.id}>
                <summary>
                  <Avatar name={user.full_name} />
                  <span className="admin-user-name">
                    <strong>{user.full_name}</strong>
                    <small>{user.email}</small>
                  </span>
                  <Badge
                    tone={
                      user.account_status === "pending"
                        ? "gold"
                        : user.account_status === "approved"
                          ? "green"
                          : "muted"
                    }
                  >
                    {statuses[user.account_status]}
                  </Badge>
                  <span className="muted">Behandle</span>
                </summary>
                <div className="admin-user-body">
                  <p className="field-hint">
                    Registrert {dateLabel(user.created_at)} · E-postadressen er bare synlig for
                    administrator.
                  </p>
                  <AdminUserForm user={user} player={player} />
                  {player && user.base_role === "player" && user.account_status === "approved" && (
                    <details className="position-editor">
                      <summary>Spillerposisjoner</summary>
                      <PositionForm player={player} />
                    </details>
                  )}
                </div>
              </details>
            );
          })}
      </div>
    </>
  );
}
