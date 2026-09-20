import { test, expect, type Page } from "@playwright/test";
import { login, provision } from "./support";

async function giphy(page: Page) {
  const searches: string[] = [];
  await page.route("https://api.giphy.com/v1/gifs**", async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("q");
    if (query !== null) searches.push(query);
    if (query === "outage") return route.fulfill({ status: 429, json: {} });
    const ids =
      url.searchParams.get("ids")?.split(",") ??
      (query === "empty"
        ? []
        : [Number(url.searchParams.get("offset")) ? "secondGif" : "firstGif"]);
    return route.fulfill({
      json: {
        data: ids.map((id) => ({
          id,
          title: id === "firstGif" ? "Volleyball celebration" : "Team meme",
          images: {
            fixed_width: { url: `https://media.giphy.com/media/${id}/200w.gif?cid=keepme` },
            fixed_width_still: { url: `https://media.giphy.com/media/${id}/200w_s.gif?cid=keepme` },
          },
        })),
        pagination: {
          offset: Number(url.searchParams.get("offset")),
          count: ids.length,
          total_count: query === "empty" ? 0 : 21,
        },
      },
    });
  });
  await page.route("https://media.giphy.com/**", (route) =>
    route.fulfill({
      contentType: "image/gif",
      body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
    }),
  );
  return searches;
}
async function newPost(page: Page, name: string) {
  await page.goto("/posts/new");
  await page.getByLabel("Tittel", { exact: true }).fill(`Diskusjon ${name}`);
  await page.getByLabel("Innlegg", { exact: true }).fill("Et innlegg med diskusjon.");
  await page.getByRole("button", { name: "Publiser innlegg", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Diskusjon ${name}`, exact: true })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Kommenter innlegget", exact: true }),
  ).toBeVisible();
  return page.url();
}

test("post comments support replies, editing, links, deletion and persistent thread context", async ({
  page,
}) => {
  const account = await provision("player");
  await login(page, account);
  await expect(page.getByRole("button", { name: "Publiser kommentar" })).toHaveCount(0);
  const url = await newPost(page, account.name);
  await page
    .getByRole("textbox", { name: "Kommenter innlegget", exact: true })
    .fill("Første kommentar https://example.com/info");
  await page.getByRole("button", { name: "Publiser kommentar" }).click();
  const roots = page.locator(".comment-threads > .comment-thread");
  await expect(roots).toHaveCount(1);
  const root = roots.first().locator(":scope > article");
  await expect(root.getByRole("link", { name: "https://example.com/info" })).toHaveAttribute(
    "href",
    "https://example.com/info",
  );
  await expect(root.getByText("Svar til innlegget", { exact: true })).toBeVisible();
  await root.getByRole("button", { name: "Svar", exact: true }).click();
  await root
    .getByRole("textbox", { name: `Svar til ${account.name}`, exact: true })
    .fill("Et svar på kommentaren");
  await root.getByRole("button", { name: "Publiser svar" }).click();
  const reply = roots.first().locator(":scope > .comment-replies > li > article").first();
  await expect(reply.getByText("Et svar på kommentaren", { exact: true })).toBeVisible();
  await expect(
    reply.getByRole("link", { name: `Svar til ${account.name}`, exact: true }),
  ).toHaveAttribute("href", /#comment-/);
  await reply.getByRole("button", { name: "Svar", exact: true }).click();
  await reply
    .getByRole("textbox", { name: `Svar til ${account.name}`, exact: true })
    .fill("Et nøstet svar");
  await reply.getByRole("button", { name: "Publiser svar" }).click();
  await expect(page.getByText("Et nøstet svar", { exact: true })).toBeVisible();
  await expect(page.locator(".comment-replies").first()).toHaveCSS("border-left-width", "2px");
  await root.getByRole("button", { name: "Rediger kommentar", exact: true }).click();
  await root
    .getByRole("textbox", { name: "Rediger kommentaren", exact: true })
    .fill("Oppdatert kommentar");
  await root.getByRole("button", { name: "Lagre kommentar" }).click();
  await expect(root.getByText("Oppdatert kommentar", { exact: true })).toBeVisible();
  await root.getByRole("button", { name: "Slett kommentar", exact: true }).click();
  await root.getByRole("button", { name: "Bekreft sletting", exact: true }).click();
  await expect(root.getByText("Kommentaren er slettet.", { exact: true })).toBeVisible();
  await expect(page.getByText("Et nøstet svar", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Et nøstet svar", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/feed");
  await expect(page.getByRole("button", { name: "Reager med et meme" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publiser kommentar" })).toHaveCount(0);
  await page.goto(url);
  await expect(page.getByText("Kommentaren er slettet.", { exact: true })).toBeVisible();
});

test("Giphy search, pagination, error recovery, reaction counts and removal work on post details", async ({
  page,
  browser,
}) => {
  test.skip(!process.env.E2E_LOCAL_ADAPTER, "Uses an isolated fake browser API key");
  const searches = await giphy(page);
  const account = await provision("player");
  await login(page, account);
  const url = await newPost(page, account.name);
  const launch = page.getByRole("button", { name: "Reager med et meme" });
  await launch.click();
  const picker = page.getByRole("dialog", { name: "Velg et meme" });
  await expect(picker.getByLabel("Søk etter memes")).toBeFocused();
  await expect(picker.getByLabel("Spill av GIF-er")).toHaveCount(0);
  await expect(picker.locator(".meme-choice img").first()).toHaveAttribute(
    "src",
    /200w.gif\?cid=keepme$/,
  );
  await expect(picker.locator(".giphy-attribution img")).toHaveCount(0);
  await picker.getByLabel("Søk etter memes").fill("volleyball & team");
  await picker.getByRole("button", { name: "Søk", exact: true }).click();
  await expect(
    picker.getByRole("button", { name: "Reager med Volleyball celebration" }),
  ).toBeVisible();
  expect(searches).toContain("volleyball & team");
  await picker.getByRole("button", { name: "Neste", exact: true }).click();
  await expect(picker.getByRole("button", { name: "Reager med Team meme" })).toBeVisible();
  await picker.getByLabel("Søk etter memes").fill("outage");
  await picker.getByRole("button", { name: "Søk", exact: true }).click();
  await expect(picker.getByRole("alert")).toContainText("søkegrensen");
  await picker.getByLabel("Søk etter memes").fill("empty");
  await picker.getByRole("button", { name: "Søk", exact: true }).click();
  await expect(picker.getByText("Ingen memes funnet. Prøv et annet søk.")).toBeVisible();
  await picker.getByLabel("Søk etter memes").fill("memes");
  await picker.getByRole("button", { name: "Søk", exact: true }).click();
  await picker.getByRole("button", { name: "Reager med Volleyball celebration" }).click();
  await expect(picker).not.toBeVisible();
  const reaction = page.getByRole("button", {
    name: "Fjern reaksjon: Volleyball celebration (1)",
    exact: true,
  });
  await expect(reaction).toHaveAttribute("aria-pressed", "true");
  await expect(reaction.locator("img")).toHaveAttribute("src", /200w.gif\?cid=keepme$/);
  await expect(page.getByLabel("Spill av GIF-er")).toHaveCount(0);
  await expect(
    page.locator(".reaction-people").getByText(account.name, { exact: true }),
  ).toBeVisible();
  await expect(page.locator("details.reaction-people")).toHaveCount(0);
  const hide = page.getByRole("button", { name: "Skjul reaksjoner", exact: true });
  await expect(hide).toHaveAttribute("aria-expanded", "true");
  await hide.click();
  await expect(page.locator(".reaction-gallery img")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Kommenter innlegget", exact: true }),
  ).toBeVisible();
  const show = page.getByRole("button", { name: "Vis reaksjoner", exact: true });
  await expect(show).toHaveAttribute("aria-expanded", "false");
  await show.click();
  await expect(reaction.locator("img")).toHaveAttribute("src", /200w.gif\?cid=keepme$/);
  await expect(
    page.locator(".reaction-people").getByText(account.name, { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(reaction).toBeVisible();

  const other = await provision("coach");
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await giphy(otherPage);
  await login(otherPage, other);
  await otherPage.goto(url);
  await otherPage
    .getByRole("button", { name: "Legg til reaksjon: Volleyball celebration (1)" })
    .click();
  await expect(
    otherPage.getByRole("button", { name: "Fjern reaksjon: Volleyball celebration (2)" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".reaction-people").getByText(account.name, { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".reaction-people").getByText(other.name, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fjern reaksjon: Volleyball celebration (2)" }).click();
  await expect(
    page.getByRole("button", { name: "Legg til reaksjon: Volleyball celebration (1)" }),
  ).toHaveAttribute("aria-pressed", "false");
  await otherContext.close();
  await launch.click();
  await page.keyboard.press("Escape");
  await expect(picker).not.toBeVisible();
  await expect(launch).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("ordinary members can discuss events, cannot moderate others, and comments survive Giphy failures", async ({
  page,
  browser,
}) => {
  test.skip(!process.env.E2E_LOCAL_ADAPTER, "Uses an isolated fake browser API key");
  await giphy(page);
  const coach = await provision("coach");
  await login(page, coach);
  await page.goto("/schedule/new");
  await page.getByLabel("Type hendelse").selectOption("practice");
  const title = `Kommentarer ${coach.name}`;
  await page.getByLabel("Tittel", { exact: true }).fill(title);
  await page.getByLabel("Starter", { exact: true }).fill("2030-04-05T18:00");
  await page.getByRole("button", { name: "Opprett hendelse", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const url = page.url();
  await page
    .getByRole("textbox", { name: "Kommenter hendelsen", exact: true })
    .fill("Trenerens kommentar");
  await page.getByRole("button", { name: "Publiser kommentar" }).click();
  await expect(page.getByText("Trenerens kommentar", { exact: true })).toBeVisible();
  const member = await provision("player");
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await giphy(memberPage);
  await login(memberPage, member);
  await memberPage.goto(url);
  const coachComment = memberPage
    .locator("article.comment")
    .filter({ hasText: "Trenerens kommentar" });
  await expect(coachComment.getByRole("button", { name: "Rediger kommentar" })).toHaveCount(0);
  await expect(coachComment.getByRole("button", { name: "Slett kommentar" })).toHaveCount(0);
  await coachComment.getByRole("button", { name: "Svar", exact: true }).click();
  await coachComment
    .getByRole("textbox", { name: `Svar til ${coach.name}`, exact: true })
    .fill("Spillerens svar");
  await coachComment.getByRole("button", { name: "Publiser svar" }).click();
  await expect(memberPage.getByText("Spillerens svar", { exact: true })).toBeVisible();
  await memberPage.getByRole("button", { name: "Reager med et meme" }).click();
  await memberPage.getByRole("button", { name: "Reager med Volleyball celebration" }).click();
  await expect(
    memberPage.getByRole("button", { name: "Fjern reaksjon: Volleyball celebration (1)" }),
  ).toBeVisible();
  await memberPage.route("https://api.giphy.com/v1/gifs**", (route) => route.abort());
  await memberPage.reload();
  await expect(memberPage.getByText("Reaksjonsbildene kunne ikke hentes.")).toBeVisible();
  await memberPage
    .getByRole("textbox", { name: "Kommenter hendelsen", exact: true })
    .fill("Kommentar uten Giphy");
  await memberPage.getByRole("button", { name: "Publiser kommentar" }).click();
  await expect(memberPage.getByText("Kommentar uten Giphy", { exact: true })).toBeVisible();
  await memberContext.close();
  await page.goto("/schedule");
  await expect(page.getByRole("button", { name: "Reager med et meme" })).toHaveCount(0);
});
