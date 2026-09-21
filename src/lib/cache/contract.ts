import type { Lineup, Notification, Player, Post, Profile, SecondaryRole } from "@/lib/domain";

export type Access = {
  profile: Profile;
  roles: SecondaryRole[];
  scope: string;
  imageLimitMB: number;
  responsiveImages: boolean;
};
export type ImageSettings = { responsive_images: boolean; version: number };
export function accessScope(profile: Profile, roles: SecondaryRole[]) {
  return encodeURIComponent(
    JSON.stringify([profile.id, profile.base_role, profile.account_status, [...roles].sort()]),
  );
}
export type AdminUsers = { users: (Profile & { email: string })[]; players: Player[] };
export type NotificationRule = { trigger_key: string; enabled: boolean };
export type PostList = { posts: Post[]; count: number };
export type Change = { kind: string; id?: string; postId?: string; matchId?: string };
export type { Lineup, Notification };
