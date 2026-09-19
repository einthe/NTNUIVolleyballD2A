import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";

const configured = Boolean(
  process.env.E2E_SUPABASE_URL && process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
);
if (process.env.E2E_REQUIRE_BACKEND === "1" && !configured)
  throw new Error("Missing integration-test backend");
test.use({ actionTimeout: 15000 });
test.skip(!configured, "Requires a disposable test backend; use npm run test:e2e:local.");

async function provision(role: "admin" | "coach" | "player") {
  const service = createClient(
    process.env.E2E_SUPABASE_URL!,
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const name = `${role} ${randomUUID().slice(0, 8)}`,
    email = `${randomUUID()}@example.test`,
    password = `Test-${randomUUID()}!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw error;
  const updated = await service
    .from("profiles")
    .update({ base_role: role, account_status: "approved" })
    .eq("id", data.user.id);
  if (updated.error) throw updated.error;
  return { service, id: data.user.id, name, email, password };
}
async function login(page: Page, account: Awaited<ReturnType<typeof provision>>) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("E-postadresse").fill(account.email);
  await page.getByLabel("Passord", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Logg inn", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Innlegg.", exact: true })).toBeVisible();
}
async function postFields(page: Page, title: string) {
  await page.getByLabel("Tittel", { exact: true }).fill(title);
  await page.getByLabel("Innlegg", { exact: true }).fill("En beskjed til hele laget.");
}
async function picture() {
  return {
    name: "trening.png",
    mimeType: "image/png",
    buffer: await sharp({ create: { width: 64, height: 48, channels: 3, background: "#77964a" } })
      .png()
      .toBuffer(),
  };
}

test("player can publish, revisit, edit and delete image/text posts without breaking the feed", async ({
  page,
  request,
}, testInfo) => {
  const account = await provision("player");
  await login(page, account);
  await expect(page.getByRole("link", { name: "Kampoppstilling", exact: true })).toHaveCount(0);
  await page.goto("/lineups/new");
  await expect(page).toHaveURL(/\/feed$/);
  const title = `Bilde ${randomUUID().slice(0, 8)}`;
  await page.getByRole("link", { name: "Nytt innlegg", exact: true }).click();
  await postFields(page, title);
  await page.locator('input[name="image"]').setInputFiles(await picture());
  await page.getByLabel("Beskriv bildet").fill("Laget på trening");
  await page.getByRole("button", { name: "Publiser innlegg" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const postUrl = page.url();
  const image = page.getByRole("img", { name: "Laget på trening" });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const imagePath = (await image.getAttribute("src"))!;
  expect((await page.request.get(imagePath)).status()).toBe(200);
  expect((await request.get(imagePath)).status()).toBe(403);
  await page.goto("/feed");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/feed-image-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  await page.goto(postUrl);
  await page.getByRole("link", { name: "Rediger", exact: true }).click();
  await expect(page.locator('input[name="image"]')).toHaveCount(0);
  await page.getByLabel("Tittel", { exact: true }).fill(`${title} redigert`);
  await page.getByRole("button", { name: "Lagre endringer" }).click();
  await expect(page.getByRole("heading", { name: `${title} redigert`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fjern bilde", exact: true }).click();
  await page.getByRole("button", { name: "Ja, fjern bilde", exact: true }).click();
  await expect(page.locator("img.post-image")).toHaveCount(0);
  await page.getByRole("link", { name: "Rediger", exact: true }).click();
  await expect(page.locator('input[name="image"]')).toBeVisible();
  await page.goto(postUrl);
  await page.getByRole("button", { name: "Slett innlegg", exact: true }).click();
  await page.getByRole("button", { name: "Ja, slett innlegg", exact: true }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByRole("heading", { name: `${title} redigert`, exact: true })).toHaveCount(
    0,
  );
  await page.goto("/posts/new");
  await postFields(page, `${title} uten bilde`);
  await page.getByRole("button", { name: "Publiser innlegg" }).click();
  await page.goto("/feed");
  await expect(
    page.getByRole("heading", { name: `${title} uten bilde`, exact: true }),
  ).toBeVisible();
});

test("a failed upload can be retried without creating duplicate posts", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.E2E_LOCAL_ADAPTER !== "1",
    "Failure injection is only available in the isolated local adapter.",
  );
  const account = await provision("player");
  await login(page, account);
  const title = `Retry ${randomUUID().slice(0, 8)}`;
  await page.goto("/posts/new");
  await postFields(page, title);
  await page.locator('input[name="image"]').setInputFiles(await picture());
  await request.post(`${process.env.E2E_SUPABASE_URL}/__test/fail`, {
    headers: { Authorization: `Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}` },
    data: { operation: "upload" },
  });
  await page.getByRole("button", { name: "Publiser innlegg" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Teksten er lagret" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Åpne det lagrede innlegget" })).toBeVisible();
  await postFields(page, title);
  await page.locator('input[name="image"]').setInputFiles(await picture());
  await page.getByRole("button", { name: "Publiser innlegg" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const { data, error } = await account.service.from("posts").select("id").eq("title", title);
  if (error) throw error;
  expect(data).toHaveLength(1);
});

test("feed failures stay contained and retry refetches content", async ({ page, request }) => {
  test.skip(
    process.env.E2E_LOCAL_ADAPTER !== "1",
    "Failure injection is only available in the isolated local adapter.",
  );
  const account = await provision("player");
  await login(page, account);
  for (const [operation, title] of [
    ["posts", "Innleggene kunne ikke hentes"],
    ["roster", "Lagoversikten kunne ikke hentes"],
  ]) {
    await request.post(`${process.env.E2E_SUPABASE_URL}/__test/fail`, {
      headers: { Authorization: `Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}` },
      data: { operation },
    });
    await page.goto("/feed");
    const fallback = page.getByRole("alert").filter({ hasText: title });
    await expect(fallback).toBeVisible();
    await expect(page.getByRole("link", { name: "Nytt innlegg", exact: true })).toBeVisible();
    await fallback.getByRole("button", { name: "Prøv igjen" }).click();
    await expect(fallback).toHaveCount(0);
  }
});

test("coach can discover lineup creation from the feed and players cannot", async ({ page }) => {
  const account = await provision("coach");
  await login(page, account);
  await page.getByRole("link", { name: "Kampoppstilling", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ny kampoppstilling.", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Opprett kamp", exact: true }).first()).toBeVisible();
});
