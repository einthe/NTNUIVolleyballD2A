import Link from "next/link";
import { Users, Search } from "lucide-react";
import { getRoster, requireAccount } from "@/server/queries";
import { canCoach, positions } from "@/lib/domain";
import { Avatar, Badge, EmptyState, PageHeading } from "@/components/ui";
import { PlayerCard } from "@/components/roster";
export const metadata = { title: "Lag" };
export default async function Roster({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; position?: string }>;
}) {
  const [profile, roster, params] = await Promise.all([
    requireAccount(),
    getRoster(),
    searchParams,
  ]);
  const allPlayers = roster.filter((p) => p.base_role === "player");
  const coaches = roster.filter((p) => p.base_role === "coach");
  const players = allPlayers.filter(
    (p) =>
      (!params.q ||
        p.full_name.toLocaleLowerCase("nb").includes(params.q.toLocaleLowerCase("nb"))) &&
      (!params.position || p.player_positions.some((pos) => pos.position_key === params.position)),
  );
  return (
    <>
      <PageHeading
        eyebrow="FOLKENE SOM GJØR FORSKJELLEN"
        title="Laget vårt"
        description="Ulike roller. Samme drakt. Samme ambisjoner."
      >
        <span className="member-count">
          <Users size={17} /> {allPlayers.length} spillere · {coaches.length} trenere
        </span>
      </PageHeading>
      <form className="roster-toolbar">
        <div className="search-field">
          <Search size={18} />
          <label className="sr-only" htmlFor="roster-search">
            Søk etter spiller
          </label>
          <input
            id="roster-search"
            name="q"
            placeholder="Søk i laget …"
            defaultValue={params.q}
            maxLength={100}
          />
        </div>
        <label className="sr-only" htmlFor="position-filter">
          Filtrer på posisjon
        </label>
        <select id="position-filter" name="position" defaultValue={params.position ?? ""}>
          <option value="">Alle posisjoner</option>
          {Object.entries(positions).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button className="button secondary">Søk</button>
        {(params.q || params.position) && (
          <Link className="text-button" href="/roster">
            Nullstill
          </Link>
        )}
      </form>
      <section>
        <h2 className="section-label">
          SPILLERE <span>{players.length}</span>
        </h2>
        <div className="roster-grid">
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} editable={canCoach(profile)} />
          ))}
        </div>
        {!players.length && (
          <div className="card">
            <EmptyState
              icon={<Users size={28} />}
              title={params.q || params.position ? "Ingen spillere passer søket" : "Laget tar form"}
            >
              <p>
                {params.q || params.position
                  ? "Prøv et annet navn eller en annen posisjon."
                  : "Godkjente spillere vises her når de har fått tilgang."}
              </p>
            </EmptyState>
          </div>
        )}
      </section>
      {coaches.length > 0 && (
        <section className="coaches-section">
          <h2 className="section-label">
            TRENERTEAMET <span>{coaches.length}</span>
          </h2>
          <div className="roster-grid">
            {coaches.map((coach) => (
              <article className="card coach-card" key={coach.id}>
                <Avatar name={coach.full_name} large />
                <div>
                  <h2>{coach.full_name}</h2>
                  <Badge tone="blue">Trener</Badge>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
