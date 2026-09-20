import "server-only";
import type { Standings } from "@/lib/standings";
import { accessToken, forgetToken } from "./auth";
import { StandingsError, type StandingsConfig } from "./config";
import { normalizeRows, tournamentSchema } from "./validation";

async function read(config: StandingsConfig, path: string): Promise<unknown> {
  const base =
    config.source === "nif"
      ? "https://data.nif.no/api/v1/ta/"
      : "https://sf48-terminlister-prod-app.azurewebsites.net/ta/";
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = config.source === "nif" ? await accessToken() : undefined;
    const response = await fetch(`${base}${path}?tournamentId=${config.tournamentId}`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (response.status === 401 && token) {
      forgetToken(token);
      if (attempt === 0) continue;
    }
    if (!response.ok) throw new StandingsError();
    return response.json();
  }
  throw new StandingsError();
}

export async function fetchStandings(config: StandingsConfig): Promise<Standings> {
  try {
    const tournament = tournamentSchema.parse(await read(config, "Tournament"));
    if (
      tournament.tournamentId !== config.tournamentId ||
      tournament.seasonId !== config.seasonId ||
      tournament.isDeleted
    )
      throw new StandingsError();
    const rows = tournament.isTablePublished
      ? normalizeRows(await read(config, "TournamentStandings/"))
      : [];
    return {
      tournament: tournament.tournamentName,
      season: tournament.seasonName ?? null,
      published: tournament.isTablePublished,
      rows,
      sourceUrl: `https://kamper.volleyball.no/standings?seasonId=${config.seasonId}&tournamentId=${config.tournamentId}`,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    // Never forward token responses, upstream bodies or validation payloads to callers/logs.
    throw new StandingsError();
  }
}
