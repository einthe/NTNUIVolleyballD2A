import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { Player, Post, TeamEvent, Lineup, Notification } from "@/lib/domain";
import type { Access, AdminUsers, NotificationRule, PostList, Change } from "./contract";

export class AccessChanged extends Error {
  constructor(public destination: string) {
    super("Tilgangen er endret.");
  }
}
export const cacheTimes = {
  session: 15_000,
  posts: 30_000,
  events: 60_000,
  roster: 300_000,
  lineups: 30_000,
  notifications: 15_000,
  admin: 15_000,
  rules: 60_000,
};
export const keys = {
  all: (scope: string) => ["team", scope] as const,
  session: (scope: string) => ["team", scope, "session"] as const,
  posts: (scope: string) => ["team", scope, "posts"] as const,
  post: (scope: string, id: string) => ["team", scope, "post", id] as const,
  events: (scope: string) => ["team", scope, "events"] as const,
  event: (scope: string, id: string) => ["team", scope, "event", id] as const,
  roster: (scope: string) => ["team", scope, "roster"] as const,
  lineups: (scope: string) => ["team", scope, "lineups"] as const,
  notifications: (scope: string) => ["team", scope, "notifications"] as const,
  users: (scope: string) => ["team", scope, "users"] as const,
  rules: (scope: string) => ["team", scope, "rules"] as const,
};
async function read<T>(
  scope: string,
  resource: string,
  signal: AbortSignal,
  params: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(`/api/team/${resource}?${new URLSearchParams(params)}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: { "X-Team-Scope": scope },
  });
  const result = await response.json();
  if ([401, 403, 409].includes(response.status))
    throw new AccessChanged(result.destination ?? "/auth/sign-in");
  if (!response.ok) throw new Error(result.error ?? "Kunne ikke hente innholdet.");
  return result.data as T;
}
export const queries = {
  session: (scope: string) =>
    queryOptions({
      queryKey: keys.session(scope),
      queryFn: ({ signal }) => read<Access>(scope, "session", signal),
      staleTime: cacheTimes.session,
    }),
  posts: (scope: string, page = 1, filter = "") =>
    queryOptions({
      queryKey: [...keys.posts(scope), { page, filter }],
      queryFn: ({ signal }) =>
        read<PostList>(scope, "posts", signal, { page: String(page), filter }),
      staleTime: cacheTimes.posts,
    }),
  post: (scope: string, id: string, client: QueryClient) =>
    queryOptions<Post | null>({
      queryKey: keys.post(scope, id),
      queryFn: ({ signal }) => read<Post | null>(scope, "post", signal, { id }),
      staleTime: cacheTimes.posts,
      // List and detail use the same complete record shape. Seed it as stale so
      // a canonical read runs, while a failed refresh can retain useful content.
      initialDataUpdatedAt: 0,
      initialData: () =>
        client
          .getQueriesData<PostList>({ queryKey: keys.posts(scope) })
          .flatMap(([, data]) => data?.posts ?? [])
          .find((p) => p.id === id),
    }),
  events: (scope: string, past = false, kind = "", page = 1) =>
    queryOptions({
      queryKey: [...keys.events(scope), { past, kind, page }],
      queryFn: ({ signal }) =>
        read<{ events: TeamEvent[]; count: number }>(scope, "events", signal, {
          history: past ? "1" : "0",
          kind,
          page: String(page),
        }),
      staleTime: cacheTimes.events,
    }),
  event: (scope: string, id: string, client: QueryClient) =>
    queryOptions<TeamEvent | null>({
      queryKey: keys.event(scope, id),
      queryFn: ({ signal }) => read<TeamEvent | null>(scope, "event", signal, { id }),
      staleTime: cacheTimes.events,
      initialDataUpdatedAt: 0,
      initialData: () =>
        client
          .getQueriesData<{ events: TeamEvent[] }>({ queryKey: keys.events(scope) })
          .flatMap(([, data]) => data?.events ?? [])
          .find((e) => e.id === id),
    }),
  roster: (scope: string) =>
    queryOptions({
      queryKey: keys.roster(scope),
      queryFn: ({ signal }) => read<Player[]>(scope, "roster", signal),
      staleTime: cacheTimes.roster,
    }),
  lineup: (scope: string, id: string, by: "match" | "id" = "match") =>
    queryOptions({
      queryKey: [...keys.lineups(scope), by, id],
      queryFn: ({ signal }) => read<Lineup | null>(scope, "lineup", signal, { id, by }),
      staleTime: cacheTimes.lineups,
      enabled: !!id,
    }),
  notifications: (scope: string) =>
    queryOptions({
      queryKey: keys.notifications(scope),
      queryFn: ({ signal }) => read<Notification[]>(scope, "notifications", signal),
      staleTime: cacheTimes.notifications,
    }),
  users: (scope: string) =>
    queryOptions({
      queryKey: keys.users(scope),
      queryFn: ({ signal }) => read<AdminUsers>(scope, "users", signal),
      staleTime: cacheTimes.admin,
    }),
  rules: (scope: string) =>
    queryOptions({
      queryKey: keys.rules(scope),
      queryFn: ({ signal }) => read<NotificationRule[]>(scope, "rules", signal),
      staleTime: cacheTimes.rules,
    }),
};

export async function invalidateChange(client: QueryClient, scope: string, change: Change) {
  const targets: (readonly unknown[])[] = [];
  const add = (...values: (readonly unknown[])[]) => targets.push(...values);
  switch (change.kind) {
    case "profile-photo":
    case "remove-profile-photo":
      add(keys.session(scope), keys.roster(scope), keys.posts(scope), ["team", scope, "post"]);
      break;
    case "post":
    case "delete-post":
    case "remove-media":
      add(keys.posts(scope));
      if (change.postId) add(keys.post(scope, change.postId));
      if (change.kind === "delete-post" && change.postId) {
        client.removeQueries({ queryKey: keys.post(scope, change.postId) });
        client.setQueriesData<PostList>(
          { queryKey: keys.posts(scope) },
          (data) =>
            data && {
              ...data,
              posts: data.posts.filter((p) => p.id !== change.postId),
              count: Math.max(
                0,
                data.count - (data.posts.some((p) => p.id === change.postId) ? 1 : 0),
              ),
            },
        );
      }
      break;
    case "event":
    case "delete-event":
      add(keys.events(scope), keys.lineups(scope));
      if (change.id) add(keys.event(scope, change.id));
      if (change.kind === "delete-event" && change.id)
        client.removeQueries({ queryKey: keys.event(scope, change.id) });
      break;
    case "lineup":
      add(keys.lineups(scope), keys.posts(scope));
      await client.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === "team" &&
          q.queryKey[1] === scope &&
          q.queryKey[2] === "post" &&
          !!(q.state.data as Post | undefined)?.lineup_id,
      });
      break;
    case "user":
    case "positions":
      add(keys.roster(scope), keys.users(scope));
      break;
    case "notification-rule":
      add(keys.rules(scope));
      break;
    case "read-notification":
      client.setQueryData<Notification[]>(keys.notifications(scope), (data) =>
        data?.map((n) => (n.id === change.id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      add(keys.notifications(scope));
      break;
  }
  await Promise.all(targets.map((queryKey) => client.invalidateQueries({ queryKey })));
  // An edited/created entity is canonical before navigating to its detail screen.
  if (change.kind === "post" && change.postId)
    await client.fetchQuery(queries.post(scope, change.postId, client));
  if (change.kind === "event" && change.id)
    await client.fetchQuery(queries.event(scope, change.id, client));
}
