import { test, expect } from "@playwright/test";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
import { login, postFields, provision } from "./support";
import { accessScope } from "../../src/lib/cache/contract";
import type { Profile } from "../../src/lib/domain";

test.skip(!process.env.E2E_SUPABASE_URL, "Requires a disposable backend.");

test("admin can turn responsive images off and on for the whole team", async ({
  page,
  browser,
}, testInfo) => {
  const admin = await provision("admin");
  const player = await provision("player");
  await login(page, admin);
  const photo = {
    name: "team.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 1800, height: 1200, channels: 3, background: "#167d8d" },
    })
      .png()
      .toBuffer(),
  };
  await page.goto("/profile");
  await page.locator('input[type="file"]').setInputFiles(photo);
  await page.getByRole("button", { name: "Last opp profilbilde", exact: true }).click();
  await expect(page.locator(".account-summary .avatar img")).toBeVisible();
  await page.goto("/posts/new");
  await postFields(page, `Bildestørrelse ${admin.name}`);
  await page.locator('input[type="file"]').setInputFiles(photo);
  await page.getByRole("button", { name: "Publiser innlegg", exact: true }).click();
  await expect(page.locator(".post-image")).toBeVisible();
  const postUrl = page.url();
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.clock.install();
  try {
    await login(other, player);
    await other.goto(postUrl);
    const image = other.locator(".post-image");
    const avatar = other.locator(".post-header .avatar img");
    await expect(image).toHaveAttribute("srcset", /w=480/);
    await expect(avatar).toHaveAttribute("srcset", /w=64/);
    await page.goto("/admin/images");
    const toggle = page.getByRole("switch", { name: "Tilpass bildestørrelse til skjermen" });
    await expect(toggle).toBeChecked();
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath("image-settings.png"), fullPage: true });
    await toggle.uncheck();
    await page.getByRole("button", { name: "Lagre", exact: true }).click();
    await expect(page.locator(".account-summary .avatar img")).toHaveAttribute("src", /w=512/);
    await page.reload();
    await expect(toggle).not.toBeChecked();
    await other.reload();
    await expect(image).not.toHaveAttribute("srcset");
    await expect(image).toHaveAttribute("src", /w=2400/);
    await expect(avatar).not.toHaveAttribute("srcset");
    await expect(avatar).toHaveAttribute("src", /w=512/);
    const response = await other.request.get((await image.getAttribute("src"))!);
    expect(response.headers()["cache-control"]).toBe("private, no-cache, must-revalidate");
    expect((await sharp(await response.body()).metadata()).width).toBe(1800);

    const scope = accessScope(
      { id: player.id, base_role: "player", account_status: "approved" } as Profile,
      [],
    );
    expect(
      (
        await other.request.get("/api/team/image-settings", { headers: { "X-Team-Scope": scope } })
      ).status(),
    ).toBe(403);
    await toggle.check();
    await page.getByRole("button", { name: "Lagre", exact: true }).click();
    await expect(page.locator(".account-summary .avatar img")).toHaveAttribute("srcset", /w=64/);
    await other.clock.fastForward(31_000);
    await expect(image).toHaveAttribute("srcset", /w=480/);
    await expect(avatar).toHaveAttribute("srcset", /w=64/);
    await other.goto("/admin/images");
    await expect(other).toHaveURL(/\/feed$/);
  } finally {
    await admin.service.from("image_settings").update({ responsive_images: true }).eq("id", true);
    await otherContext.close();
  }
});
