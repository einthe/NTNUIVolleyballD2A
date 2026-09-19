import { describe, expect, it } from "vitest";
import {
  canCoach,
  canManageEvent,
  eventTypes,
  imageSchema,
  lineupSchema,
  postSchema,
  registrationSchema,
  userSchema,
  positionSchema,
  type Profile,
  type SecondaryRole,
  type EventType,
} from "../src/lib/domain";
import { toUTC, dateLabel } from "../src/lib/dates";
const profile: Profile = {
  id: "00000000-0000-4000-a000-000000000001",
  full_name: "Test Player",
  account_status: "approved",
  base_role: "player",
  created_at: "2026-01-01T00:00:00Z",
};
describe("schedule authorization", () => {
  it("denies ordinary players and inactive accounts", () => {
    for (const type of Object.keys(eventTypes) as EventType[]) {
      expect(canManageEvent(profile, [], type)).toBe(false);
      expect(
        canManageEvent({ ...profile, base_role: "admin", account_status: "disabled" }, [], type),
      ).toBe(false);
      expect(
        canManageEvent({ ...profile, account_status: "pending" }, ["team_manager"], type),
      ).toBe(false);
    }
  });
  it("limits coaches to matches and practices", () => {
    for (const type of Object.keys(eventTypes) as EventType[])
      expect(canManageEvent({ ...profile, base_role: "coach" }, [], type)).toBe(
        ["match", "practice"].includes(type),
      );
  });
  it("permits only the matching responsibility and own events", () => {
    const cases: [SecondaryRole, EventType][] = [
      ["team_manager", "team_logistics"],
      ["travel_coordinator", "travel"],
      ["social_coordinator", "social"],
      ["financial_manager", "finance"],
      ["volunteer_work_coordinator", "volunteer_work"],
    ];
    for (const [role, type] of cases) {
      expect(canManageEvent(profile, [role], type)).toBe(true);
      expect(canManageEvent(profile, [role], type, profile.id)).toBe(true);
      expect(canManageEvent(profile, [role], type, "other-user")).toBe(false);
    }
    expect(
      canManageEvent(profile, ["captain", "vice_captain", "social_media_manager"], "practice"),
    ).toBe(false);
  });
  it("does not treat a secondary role or player position as coach", () => {
    expect(canCoach(profile)).toBe(false);
    expect(canCoach({ ...profile, base_role: "coach" })).toBe(true);
  });
});
describe("runtime validation", () => {
  it("requires neither jersey nor position at registration", () => {
    expect(
      registrationSchema.safeParse({
        full_name: "Test Player",
        email: "test@example.com",
        password: "long-test-password",
      }).success,
    ).toBe(true);
  });
  it("rejects admin assignment and invalid jersey numbers", () => {
    const data = {
      id: profile.id,
      full_name: "Test User",
      base_role: "player",
      account_status: "approved",
      jersey_number: null,
      roles: [],
    };
    expect(userSchema.safeParse(data).success).toBe(true);
    expect(userSchema.safeParse({ ...data, base_role: "admin" }).success).toBe(false);
    expect(userSchema.safeParse({ ...data, jersey_number: 100 }).success).toBe(false);
  });
  it("bounds post input and validates image metadata", () => {
    expect(postSchema.safeParse({ title: "", body: "test", role_context: null }).success).toBe(
      false,
    );
    expect(imageSchema.safeParse({ type: "image/svg+xml", size: 100 }).success).toBe(false);
    expect(imageSchema.safeParse({ type: "image/png", size: 11 * 1024 * 1024 }).success).toBe(
      false,
    );
  });
  it("rejects primary position repeated as secondary", () => {
    expect(
      positionSchema.safeParse({ id: profile.id, primary: "setter", secondary: ["setter"] })
        .success,
    ).toBe(false);
  });
  it("allows incomplete drafts but validates published slots and libero uniqueness", () => {
    const slots = Array.from({ length: 6 }, (_, i) => ({
      player_user_id: `00000000-0000-4000-a000-00000000000${i + 1}`,
      court_position: i + 1,
      is_libero: false,
    }));
    const data = { match_id: profile.id, expected_revision: 0, publish: true, slots };
    expect(lineupSchema.safeParse(data).success).toBe(true);
    expect(lineupSchema.safeParse({ ...data, slots: slots.slice(0, 5) }).success).toBe(false);
    expect(lineupSchema.safeParse({ ...data, publish: false, slots: [] }).success).toBe(true);
    expect(
      lineupSchema.safeParse({
        ...data,
        slots: [...slots, { ...slots[0], court_position: null, is_libero: true }],
      }).success,
    ).toBe(false);
    expect(
      lineupSchema.safeParse({ ...data, slots: slots.map((s) => ({ ...s, court_position: 1 })) })
        .success,
    ).toBe(false);
  });
});
describe("Norwegian date handling", () => {
  it("converts both winter and summer Oslo times to UTC", () => {
    expect(toUTC("2026-01-10T18:00")).toBe("2026-01-10T17:00:00.000Z");
    expect(toUTC("2026-07-10T18:00")).toBe("2026-07-10T16:00:00.000Z");
  });
  it("rejects the nonexistent hour at spring DST change", () => {
    expect(() => toUTC("2026-03-29T02:30")).toThrow("sommertid");
  });
  it("formats stored UTC dates in the team timezone", () => {
    expect(dateLabel("2026-07-10T16:00:00Z", "HH:mm")).toBe("18:00");
  });
});
