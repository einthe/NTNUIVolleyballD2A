import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPassword } from "../../scripts/demo-seed.mjs";
async function login(page: Page, email: string) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("E-postadresse").fill(email);
  await page.getByLabel("Passord", { exact: true }).fill(demoPassword);
  await page.getByRole("button", { name: "Logg inn", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Innlegg.", exact: true })).toBeVisible();
}
test("admin independently controls email/in-app notifications, and demo captures safe email previews", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90000);
  await login(page, "admin@demo.test");
  await page.goto("/admin/notifications");
  const row = page
    .locator("form.notification-rule")
    .filter({ has: page.locator('input[name="trigger_key"][value="post_by_coach"]') });
  const app = row.getByRole("switch", { name: "Innlegg fra trener – I appen", exact: true });
  const email = row.getByRole("switch", { name: "Innlegg fra trener – E-post", exact: true });
  await app.uncheck();
  await email.check();
  await row.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(row.getByRole("status")).toContainText("lagret");
  await page.reload();
  await expect(app).not.toBeChecked();
  await expect(email).toBeChecked();
  await expect(
    page.getByText("Lokal demo: e-poster forhåndsvises her og sendes ikke."),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("notification-settings.png"), fullPage: true });
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3101" });
  try {
    const coach = await context.newPage();
    await login(coach, "coach@demo.test");
    const title = `E-postvarsel ${info.project.name}`;
    await coach.getByRole("link", { name: "Nytt innlegg", exact: true }).click();
    await coach.getByLabel("Tittel", { exact: true }).fill(title);
    await coach
      .getByLabel("Innlegg", { exact: true })
      .fill("Test av lokal forhåndsvisning uten sending.");
    await coach.getByRole("button", { name: "Publiser innlegg", exact: true }).click();
    await expect(coach.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(async () => {
      await page.reload();
      await page.getByText("Siste e-postvarsler", { exact: true }).click();
      await expect(
        page.locator(".notification-delivery article").filter({ hasText: title }).first(),
      ).toBeVisible();
      await expect(
        page.locator(".notification-delivery article").filter({ hasText: title }).first(),
      ).toContainText("Forhåndsvist");
    }).toPass({ timeout: 20000 });
    await page.locator(".notification-menu > summary").click();
    await expect(page.locator(".notification-item").filter({ hasText: title })).toHaveCount(0);
    await page.locator(".notification-menu > summary").click();
    await app.check();
    await email.uncheck();
    await row.getByRole("button", { name: "Lagre", exact: true }).click();
    await expect(row.getByRole("status")).toContainText("lagret");
    await coach.goto("/admin/notifications");
    await expect(coach).not.toHaveURL(/\/admin\/notifications$/);
  } finally {
    await context.close();
  }
});
