import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
const db = new PGlite();
const users = {
  admin: randomUUID(),
  coach: randomUUID(),
  owner: randomUUID(),
  member: randomUUID(),
  manager: randomUUID(),
  pending: randomUUID(),
  disabled: randomUUID(),
};
type Actor = keyof typeof users;
async function as<T>(actor: Actor, fn: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [users[actor]]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function rpc<T = string>(name: string, data: unknown): Promise<T> {
  return (
    await db.query<{ value: T }>(`select public.${name}($1::jsonb) as value`, [
      JSON.stringify(data),
    ])
  ).rows[0].value;
}
const post = (actor: Actor = "owner", role?: string) =>
  as(actor, () => rpc("save_post", { title: "Testinnlegg", body: "Innhold", role_context: role }));
const event = (actor: Actor = "coach", kind = "practice") =>
  as(actor, () =>
    rpc("save_event", {
      event_type: kind,
      title: "Testhendelse",
      description: "Detaljer",
      starts_at: "2026-10-01T16:00:00Z",
      ends_at: "2026-10-01T18:00:00Z",
      location: "Hallen",
      assignments: [],
    }),
  );
const rule = (key: string, app = true, email = true) =>
  as("admin", () =>
    rpc("set_notification_rule", { trigger_key: key, enabled: app, email_enabled: email }),
  );
const rows = async (table = "notifications") =>
  (
    await db.query<{
      user_id: string;
      trigger_key: string;
      target_type: string;
      status: string;
      id: string;
    }>(`select * from ${table}`)
  ).rows;
let originalPost: string, originalEvent: string;
beforeAll(async () => {
  await db.exec(readFileSync("tests/fixtures/supabase-schema.sql", "utf8"));
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  for (const [name, id] of Object.entries(users)) {
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [
      id,
      `${name}@example.test`,
      JSON.stringify({ full_name: name }),
    ]);
    await db.query("update profiles set base_role=$2,account_status=$3 where id=$1", [
      id,
      ["coach", "admin"].includes(name) ? name : "player",
      ["pending", "disabled"].includes(name) ? name : "approved",
    ]);
  }
  await db.query(
    "insert into player_secondary_roles(player_user_id,role_key,assigned_by) values($1,'social_coordinator',$2)",
    [users.manager, users.admin],
  );
  originalPost = await post();
  originalEvent = await event();
});
beforeEach(async () => {
  await db.exec(
    "truncate notification_email_queue,notifications; update notification_rules set enabled=false,email_enabled=false",
  );
});
afterAll(() => db.close());
it("keeps new channels off, preserves admin-only controls and hides the email queue", async () => {
  await post();
  expect(await rows()).toEqual([]);
  expect(await rows("notification_email_queue")).toEqual([]);
  for (const actor of ["member", "coach", "pending"] as const) {
    await expect(
      as(actor, () =>
        rpc("set_notification_rule", {
          trigger_key: "fine_received",
          enabled: true,
          email_enabled: true,
        }),
      ),
    ).rejects.toThrow("not_authorized");
    await expect(
      as(actor, () => db.query("select * from notification_email_queue")),
    ).rejects.toThrow("permission denied");
    await expect(as(actor, () => rpc("claim_notification_emails", {}))).rejects.toThrow(
      "permission denied",
    );
    await expect(as(actor, () => db.query("select notification_email_status()"))).rejects.toThrow(
      "not_authorized",
    );
  }
});
it("routes posts by published role, supports email-only and app-only, and deduplicates overlapping rules", async () => {
  await rule("post_by_social_coordinator", false, true);
  await post("manager", "social_coordinator");
  expect(await rows()).toHaveLength(0);
  expect((await rows("notification_email_queue")).map((r) => r.user_id).sort()).toEqual(
    [users.admin, users.coach, users.owner, users.member].sort(),
  );
  await rule("role_context_post_created");
  await post("manager", "social_coordinator");
  expect(await rows()).toHaveLength(4);
  expect(await rows("notification_email_queue")).toHaveLength(8);
  await post("manager");
  expect(await rows()).toHaveLength(4);
  await rule("post_by_coach", true, false);
  await post("coach");
  expect(await rows()).toHaveLength(8);
  expect(await rows("notification_email_queue")).toHaveLength(8);
});
it("combines role and event-type rules without duplicates", async () => {
  await rule("event_by_social_coordinator");
  await rule("social_event_created");
  await event("manager", "social");
  expect(await rows()).toHaveLength(4);
  expect(await rows("notification_email_queue")).toHaveLength(4);
  await event();
  expect(await rows()).toHaveLength(4);
  await rule("event_by_coach");
  await rule("practice_created");
  await event();
  expect(await rows()).toHaveLength(8);
});
it("notifies only content authors and direct reply authors, never commenters themselves or on edits", async () => {
  for (const key of [
    "post_comment_created",
    "event_comment_created",
    "comment_reply_created",
    "post_reaction_created",
    "event_reaction_created",
  ])
    await rule(key);
  const data = {
    id: randomUUID(),
    target_type: "post",
    target_id: originalPost,
    body: "Hei",
    parent_id: null,
    expected_version: null,
  };
  await as("member", () => rpc("save_comment", data));
  expect((await rows()).map((r) => r.user_id)).toEqual([users.owner]);
  await as("manager", () => rpc("save_comment", { ...data, id: randomUUID(), parent_id: data.id }));
  expect((await rows()).map((r) => r.user_id)).toEqual([users.owner, users.member]);
  await as("member", () => rpc("save_comment", { ...data, body: "Endret", expected_version: 0 }));
  await as("owner", () => rpc("save_comment", { ...data, id: randomUUID() }));
  expect(await rows()).toHaveLength(2);
  await as("member", () =>
    rpc("save_comment", {
      ...data,
      id: randomUUID(),
      target_type: "event",
      target_id: originalEvent,
    }),
  );
  const reaction = { target_type: "post", target_id: originalPost, giphy_id: "abc", active: true };
  await as("member", () => rpc("set_meme_reaction", reaction));
  await as("member", () => rpc("set_meme_reaction", reaction));
  await as("member", () => rpc("set_meme_reaction", { ...reaction, active: false }));
  await as("member", () =>
    rpc("set_meme_reaction", { ...reaction, target_type: "event", target_id: originalEvent }),
  );
  expect((await rows()).map((r) => r.user_id)).toEqual([
    users.owner,
    users.member,
    users.coach,
    users.owner,
    users.coach,
  ]);
  expect(await rows("notification_email_queue")).toHaveLength(5);
});
it("notifies only the recipient of fines and changed points, without repeated awards", async () => {
  await rule("fine_received");
  await rule("volunteer_points_changed");
  const type = await as("admin", () =>
    rpc("save_fine_type", { name: "Testbot", amount_ore: 5000, active: true, description: "" }),
  );
  const fine = {
    id: randomUUID(),
    user_id: users.member,
    fine_type_id: type,
    expected_type_version: 0,
    note: "",
  };
  await as("admin", () => rpc("apply_fine", fine));
  await as("admin", () => rpc("apply_fine", fine));
  const points = { id: users.member, points: 10, expected_version: 0 };
  await as("admin", () => rpc("set_volunteer_work_points", points));
  await as("admin", () => rpc("set_volunteer_work_points", { ...points, expected_version: 1 }));
  expect((await rows()).map((r) => [r.user_id, r.target_type])).toEqual([
    [users.member, "fine"],
    [users.member, "volunteer_points"],
  ]);
  expect(await rows("notification_email_queue")).toHaveLength(2);
});
type Job = { id: string; lease_id: string; payload: unknown; status: string };
it("leases jobs once, freezes retry payloads, rejects stale acknowledgements and stops after the idempotency window", async () => {
  await rule("post_comment_created", false, true);
  await as("member", () =>
    rpc("save_comment", {
      id: randomUUID(),
      target_type: "post",
      target_id: originalPost,
      body: "Hei",
    }),
  );
  const [job] = await rpc<Job[]>("claim_notification_emails", {});
  expect(job).toBeDefined();
  expect(await rpc("claim_notification_emails", {})).toEqual([]);
  expect(
    await rpc("prepare_notification_email", { ...job, payload: { text: "original" } }),
  ).toEqual({ text: "original" });
  await rpc("finish_notification_email", { ...job, status: "pending", error: "provider_http_429" });
  await db.exec("update notification_email_queue set available_at=now()");
  const [retry] = await rpc<Job[]>("claim_notification_emails", {});
  expect(retry.lease_id).not.toBe(job.lease_id);
  expect(
    await rpc("prepare_notification_email", { ...retry, payload: { text: "changed" } }),
  ).toEqual({ text: "original" });
  await rpc("finish_notification_email", { ...job, status: "sent" });
  expect((await rows("notification_email_queue"))[0].status).toBe("sending");
  await db.exec(
    "update notification_email_queue set lease_until=now()-interval '1 minute', first_attempt_at=now()-interval '24 hours'",
  );
  expect(await rpc("claim_notification_emails", {})).toEqual([]);
  expect((await rows("notification_email_queue"))[0].status).toBe("failed");
});
it("rechecks disabled rules, inactive/unverified recipients, changed addresses and deleted content before sending", async () => {
  for (const scenario of [
    "disabled-rule",
    "disabled-user",
    "unverified",
    "changed-email",
    "deleted-post",
  ] as const) {
    await db.exec("truncate notification_email_queue");
    await db.query("update profiles set account_status='approved' where id=$1", [users.owner]);
    await db.query(
      "update auth.users set email='owner@example.test',email_confirmed_at=now() where id=$1",
      [users.owner],
    );
    await rule("post_comment_created", false, true);
    const target = await post();
    await as("member", () =>
      rpc("save_comment", {
        id: randomUUID(),
        target_type: "post",
        target_id: target,
        body: "Hei",
      }),
    );
    if (scenario === "disabled-rule") await rule("post_comment_created", false, false);
    if (scenario === "disabled-user")
      await db.query("update profiles set account_status='disabled' where id=$1", [users.owner]);
    if (scenario === "unverified")
      await db.query("update auth.users set email_confirmed_at=null where id=$1", [users.owner]);
    if (scenario === "deleted-post")
      await as("owner", () => db.query("select delete_post($1)", [target]));
    if (scenario === "changed-email")
      await db.exec("update notification_email_queue set recipient_email='old@example.test'");
    expect(await rpc("claim_notification_emails", {})).toEqual([]);
    expect((await rows("notification_email_queue"))[0].status).toBe("cancelled");
  }
});
