import { randomUUID } from "node:crypto";
import sharp from "sharp";

export const demoPassword = "DemoVolleyball123!";

export async function seedDemo({ db, addUser, files }) {
  async function user(email, full_name) {
    return addUser({
      email: `${email}@demo.test`,
      password: demoPassword,
      user_metadata: { full_name },
    });
  }
  async function rpc(actor, name, data) {
    await db.exec("set role authenticated");
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor.id]);
      return (await db.query(`select public.${name}($1::jsonb) as id`, [JSON.stringify(data)]))
        .rows[0].id;
    } finally {
      await db.exec("reset role");
    }
  }
  const admin = await user("admin", "Andrea Berg (demo)");
  await db.query(
    "update public.profiles set base_role='admin', account_status='approved', approved_at=now() where id=$1",
    [admin.id],
  );
  async function member(email, name, role, extra = {}) {
    const account = await user(email, name);
    await rpc(admin, "manage_user", {
      id: account.id,
      full_name: name,
      base_role: role,
      account_status: "approved",
      roles: [],
      ...extra,
    });
    return account;
  }
  const coach = await member("coach", "Markus Strand", "coach");
  await member("assistant", "Sara Lunde", "coach");
  const roster = [
    ["player", "Emil Solberg", 1, "setter", ["captain"]],
    ["jonas", "Jonas Vik", 4, "outside_hitter", ["vice_captain", "social_media_manager"]],
    ["oliver", "Oliver Dahl", 6, "middle_blocker", ["team_manager"]],
    ["noah", "Noah Nilsen", 8, "opposite", ["travel_coordinator"]],
    ["henrik", "Henrik Moen", 10, "outside_hitter", ["social_coordinator"]],
    ["oskar", "Oskar Bakke", 12, "middle_blocker", ["financial_manager"]],
    ["lucas", "Lucas Eide", 3, "libero", ["volunteer_work_coordinator"]],
    ["theo", "Theo Aasen", 5, "setter", []],
    ["isak", "Isak Holm", 7, "outside_hitter", []],
    ["mathias", "Mathias Lund", 9, "opposite", []],
    ["adrian", "Adrian Foss", 14, "middle_blocker", []],
    ["felix", "Felix Hagen", 16, "libero", []],
  ];
  const players = [];
  for (const [email, name, jersey_number, primary, roles] of roster) {
    const player = await member(email, name, "player", { jersey_number, roles });
    await rpc(coach, "set_positions", { id: player.id, primary, secondary: [] });
    players.push(player);
  }
  await user("pending", "Sander Nygaard");
  await member("disabled", "William Lie", "player", { account_status: "disabled" });
  for (const trigger_key of [
    "normal_post_created",
    "role_context_post_created",
    "lineup_published",
    "volunteer_assignment_created",
  ]) {
    await rpc(admin, "set_notification_rule", { trigger_key, enabled: true });
  }

  const date = (days, hour = 16) => {
    const value = new Date();
    value.setUTCDate(value.getUTCDate() + days);
    value.setUTCHours(hour, 0, 0, 0);
    return value.toISOString();
  };
  async function event(event_type, title, days, extra = {}) {
    return rpc(admin, "save_event", {
      event_type,
      title,
      description: "Fiktiv hendelse til lokal utprøving.",
      starts_at: date(days),
      ends_at: date(days, 18),
      location: "Campus Arena (demo)",
      ...extra,
    });
  }
  await event("practice", "Trening: mottak og forsvar", 1);
  await event("practice", "Trening: angrep og blokk", 3);
  const match = await event("match", "NTNUI – Fjordvik", 5, {
    opponent: "Fjordvik VK",
    home_away: "home",
  });
  const nextMatch = await event("match", "Bortekamp mot Nordstrand", 12, {
    opponent: "Nordstrand Volley",
    home_away: "away",
    location: "Nordstrandhallen (demo)",
  });
  await event("match", "NTNUI – Solsiden", 19, { opponent: "Solsiden VK", home_away: "home" });
  await event("match", "NTNUI – Vestbyen", -7, {
    opponent: "Vestbyen VK",
    home_away: "home",
    team_sets: 3,
    opponent_sets: 1,
  });
  await event("social", "Lagkveld med pizza", 6, { location: "Klubbrommet (demo)" });
  await event("volunteer_work", "Dugnad: rigging til hjemmekamp", 4, {
    assignments: players.slice(0, 4).map((p) => p.id),
  });
  await event("travel", "Felles avreise til bortekamp", 12, { location: "Hovedinngangen (demo)" });
  await event("team_logistics", "Utdeling av drakter", 2);
  await event("finance", "Frist for egenandel til turnering", 10);
  await event("other", "Planlegging av neste sesong", 25);

  const slots = players.slice(0, 7).map((p, i) => ({
    player_user_id: p.id,
    court_position: i < 6 ? i + 1 : null,
    is_libero: i === 6,
  }));
  await rpc(coach, "save_lineup", { match_id: match, expected_revision: 0, publish: false, slots });
  await rpc(coach, "save_lineup", { match_id: match, expected_revision: 1, publish: true, slots });
  await rpc(coach, "save_lineup", {
    match_id: nextMatch,
    expected_revision: 0,
    publish: false,
    slots: slots.slice(0, 4),
  });
  await rpc(coach, "save_post", {
    title: "Plan for treningsuka",
    body: "På tirsdag jobber vi med mottak og forsvar. Torsdag blir det angrep, blokk og spill. Ta med vannflaske og møt ferdig oppvarmet.",
  });
  await rpc(players[0], "save_post", {
    title: "Klare for hjemmekamp?",
    body: "Husk drakt og innesko! Vi samles ved banen 45 minutter før kampstart.",
    role_context: "captain",
  });
  await rpc(players[4], "save_post", {
    title: "Pizza etter trening",
    body: "Vi samles i klubbrommet etter trening på fredag. Se lagkvelden i terminlisten.",
    role_context: "social_coordinator",
  });
  const imagePost = await rpc(coach, "save_post", {
    title: "Baneoppsett til helgen",
    body: "Eksempelbilde for å teste innlegg med vedlegg. Alt innhold i denne lokale databasen er fiktivt.",
  });
  const bytes = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#14262d"/><rect x="120" y="60" width="720" height="420" fill="#1c333c" stroke="#8ad9d4" stroke-width="5"/><path d="M480 60v420M360 60v420M600 60v420" stroke="#8ad9d4" stroke-width="3"/><circle cx="720" cy="360" r="48" fill="#8ad9d4"/><path d="M676 343q45-20 74 52M720 312q-15 52 47 48" stroke="#14262d" fill="none" stroke-width="4"/></svg>`,
    ),
  )
    .webp()
    .toBuffer();
  const storagePath = `${coach.id}/${randomUUID()}.webp`;
  await db.query(
    "insert into storage.objects(bucket_id,name,owner_id) values('post-images',$1,$2)",
    [storagePath, coach.id],
  );
  files.set(`post-images/${storagePath}`, bytes);
  await rpc(coach, "attach_media", {
    post_id: imagePost,
    storage_path: storagePath,
    mime_type: "image/webp",
    size_bytes: bytes.length,
    alt_text: "Illustrasjon av en volleyballbane – lokalt eksempelbilde",
  });
}
