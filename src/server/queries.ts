import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, isConfigured } from "@/lib/supabase/server";
import type {
  Player,
  Profile,
  SecondaryRole,
  TeamEvent,
  Post,
  Lineup,
  Notification,
} from "@/lib/domain";

export const getAccount = cache(async () => {
  if (!isConfigured()) return null;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db
    .from("profiles")
    .select("id,full_name,base_role,account_status,created_at,profile_photos(storage_path)")
    .eq("id", user.id)
    .single();
  if (error) throw new Error("Kunne ikke hente kontoen. Prøv igjen.");
  return data as unknown as Profile;
});
export const requireAccount = cache(async () => {
  const profile = await getAccount();
  if (!profile) redirect("/auth/sign-in");
  if (profile.account_status !== "approved")
    redirect(`/auth/${profile.account_status === "pending" ? "pending" : "rejected"}`);
  return profile;
});
export async function requireAdmin() {
  const profile = await requireAccount();
  if (profile.base_role !== "admin") redirect("/feed");
  return profile;
}
export const getRoles = cache(async (account?: Profile): Promise<SecondaryRole[]> => {
  const profile = account ?? (await requireAccount());
  if (profile.base_role !== "player") return [];
  const db = await createClient();
  const { data, error } = await db
    .from("player_secondary_roles")
    .select("role_key")
    .eq("player_user_id", profile.id);
  if (error) throw new Error("Kunne ikke hente ansvarsroller.");
  return (data ?? []).map((r) => r.role_key as SecondaryRole);
});
export const getRoster = cache(async (account?: Profile): Promise<Player[]> => {
  if (!account) await requireAccount();
  const db = await createClient();
  const { data, error } = await db
    .from("profiles")
    .select(
      "id,full_name,base_role,account_status,created_at,profile_photos(storage_path),player_profiles(jersey_number),player_positions:player_positions!player_positions_player_user_id_fkey(position_key,is_primary),player_secondary_roles:player_secondary_roles!player_secondary_roles_player_user_id_fkey(role_key)",
    )
    .eq("account_status", "approved")
    .in("base_role", ["player", "coach"])
    .order("full_name");
  if (error) throw new Error("Kunne ikke hente laget.");
  return data as unknown as Player[];
});
async function withAuthorPhotos(posts: Post[]): Promise<Post[]> {
  if (!posts.length) return posts;
  const db = await createClient();
  const { data, error } = await db
    .from("profile_photos")
    .select("user_id,storage_path")
    .in("user_id", [...new Set(posts.map((post) => post.author_user_id))]);
  // Optional photos must never make the feed unavailable.
  if (error) return posts;
  const photos = new Map((data ?? []).map((photo) => [photo.user_id, photo.storage_path]));
  return posts.map((post) => ({
    ...post,
    author_photo_path: photos.get(post.author_user_id) ?? null,
  }));
}
export async function getPosts(page = 1, kind?: string, account?: Profile) {
  if (!account) await requireAccount();
  const db = await createClient();
  let query = db
    .from("posts")
    .select("*,post_media(id,alt_text)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (kind === "lineup") query = query.eq("post_type", "lineup");
  if (kind === "roles") query = query.not("secondary_role_context_key", "is", null);
  const { data, error, count } = await query.range((page - 1) * 12, page * 12 - 1);
  if (error) throw new Error("Kunne ikke hente innlegg.");
  return { posts: await withAuthorPhotos(data as Post[]), count: count ?? 0 };
}
export async function getPost(id: string, account?: Profile) {
  if (!account) await requireAccount();
  const db = await createClient();
  const { data, error } = await db
    .from("posts")
    .select("*,post_media(id,alt_text)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Kunne ikke hente innlegget.");
  return data ? (await withAuthorPhotos([data as Post]))[0] : null;
}
const eventSelect =
  "*,match_details(opponent,home_away,team_sets,opponent_sets),volunteer_assignments(player_user_id)";
export async function getEvents(past = false, kind?: string, page = 1, account?: Profile) {
  if (!account) await requireAccount();
  const db = await createClient();
  let query = db
    .from("schedule_events")
    .select(eventSelect, { count: "exact" })
    .order("starts_at", { ascending: !past })
    .order("id");
  query = past
    ? query.lt("starts_at", new Date().toISOString())
    : query.gte("starts_at", new Date().toISOString());
  if (kind) query = query.eq("event_type", kind);
  const { data, error, count } = await query.range((page - 1) * 24, page * 24 - 1);
  if (error) throw new Error("Kunne ikke hente terminlisten.");
  return { events: data as unknown as TeamEvent[], count: count ?? 0 };
}
export async function getEvent(id: string, account?: Profile) {
  if (!account) await requireAccount();
  const db = await createClient();
  const { data, error } = await db
    .from("schedule_events")
    .select(eventSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Kunne ikke hente arrangementet.");
  return data as unknown as TeamEvent | null;
}
export async function getLineup(matchId: string, account?: Profile): Promise<Lineup | null> {
  if (!account) await requireAccount();
  const db = await createClient();
  const { data, error } = await db
    .from("lineups")
    .select("*,schedule_events(*,match_details(*)),lineup_revisions(*,lineup_revision_slots(*))")
    .eq("match_event_id", matchId)
    .maybeSingle();
  if (error) throw new Error("Kunne ikke hente oppstillingen.");
  return data as unknown as Lineup | null;
}
export async function getLineupById(id: string, account?: Profile): Promise<Lineup | null> {
  if (!account) await requireAccount();
  const db = await createClient();
  const { data, error } = await db
    .from("lineups")
    .select("*,schedule_events(*,match_details(*)),lineup_revisions(*,lineup_revision_slots(*))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Kunne ikke hente oppstillingen.");
  return data as unknown as Lineup | null;
}
export async function getNotifications(account?: Profile): Promise<Notification[]> {
  const profile = account ?? (await requireAccount());
  const db = await createClient();
  const { data, error } = await db
    .from("notifications")
    .select("id,title,body,target_type,target_id,read_at,created_at")
    .eq("user_id", profile.id)
    .order("read_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Kunne ikke hente varsler.");
  return data as Notification[];
}
