import "server-only";
import { unstable_cache } from "next/cache";
import { fetchStandings } from "./client";
import { standingsConfig } from "./config";

// Only validated public competition data enters the shared Data Cache.
// Authorization runs in the route handler, outside this cache; tokens stay in memory.
const cachedStandings = unstable_cache(fetchStandings, ["volleyball-standings-v2"], {
  revalidate: 24 * 60 * 60,
});

export function getStandings() {
  return cachedStandings(standingsConfig());
}
