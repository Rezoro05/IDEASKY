import { test, expect, type Page } from "@playwright/test";
import { fakeServices, settled, gioRow } from "./fixtures";

test.describe("stages and links", () => {
  async function postWithLinks(page: Page, links: [string, string][]) {
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-msg").fill("A shared tool library");
    for (const [url, title] of links) {
      await page.locator("#compose .add-link").click();
      const row = page.locator(".link-row").last();
      await row.locator(".link-url").fill(url);
      await row.locator(".link-title").fill(title);
    }
    await page.locator(".note-send").click();
  }
  async function openOnly(page: Page) {
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1, { timeout: 8000 });
    await plane.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
    await settled(page);
  }

  test("an idea is posted with its links, which open safely in a new tab", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, [["toolshare.example.org/plan", "Pilot plan"], ["https://github.com/someone/tools", ""]]);
    await expect.poll(() => board.posts.length).toBe(1);
    expect(board.posts[0]).toMatchObject({ links: [{ title: "Pilot plan", url: "https://toolshare.example.org/plan" }, { title: "github.com", url: "https://github.com/someone/tools" }] });
    expect(board.posts[0]).not.toHaveProperty("stage"); // the database starts every idea at "idea"
    await openOnly(page);
    const links = page.locator("#letter-links a");
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute("href", "https://toolshare.example.org/plan");
    await expect(links.first()).toHaveAttribute("target", "_blank");
    await expect(links.first()).toHaveAttribute("rel", /noopener/);
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Idea");
  });

  test("a link that isn't a web address stops the send and points at its row", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, [["example.com", ""], ["javascript:alert(1)", "Click me"]]);
    await expect(page.locator("#note-error")).toContainText("isn’t a web address");
    await expect(page.locator(".link-row").nth(1).locator(".link-url")).toBeFocused();
    await page.waitForTimeout(300);
    expect(board.posts).toHaveLength(0);
  });

  test("up to five links; a row can be removed", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    for (let i = 0; i < 5; i++) await page.locator("#compose .add-link").click();
    await expect(page.locator(".link-row")).toHaveCount(5);
    await expect(page.locator("#compose .add-link")).toBeHidden();
    await page.locator(".link-row .link-remove").first().click();
    await expect(page.locator(".link-row")).toHaveCount(4);
    await expect(page.locator("#compose .add-link")).toBeVisible();
  });

  test("the owner moves the idea one step at a time, each move asked first; its plane changes form", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    await expect(page.locator("#stage-back")).toBeHidden();
    await page.locator("#stage-forward").click();
    await expect(page.locator("#stage-question")).toHaveText("Move this idea to Implementation?");
    await page.locator("#stage-cancel").click(); // changed my mind
    await expect(page.locator("#stage-confirm")).toBeHidden();
    expect(board.stageMoves ?? []).toHaveLength(0);
    await page.locator("#stage-forward").click();
    await page.locator("#stage-yes").click();
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Implementation");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "implementation");
    expect(board.stageMoves!.at(-1)).toMatchObject({ p_stage: "implementation", p_key: expect.stringMatching(/^[0-9a-f]{32}$/) });
    await page.locator("#stage-forward").click();
    await page.locator("#stage-yes").click();
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Live");
    await expect(page.locator("#stage-forward")).toBeHidden();
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "live");
    await page.locator("#stage-back").click();
    await expect(page.locator("#stage-question")).toHaveText("Move this idea to Implementation?");
  });

  test("other people's ideas show their stage and form, with no way to move them", async ({ page }) => {
    await fakeServices(page, { rows: [{ ...gioRow, stage: "live", links: [{ title: "Market map", url: "https://markets.example.com/" }] }], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "live");
    await openOnly(page);
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Live");
    await expect(page.locator("#stage-moves")).toBeHidden();
    await expect(page.locator("#letter-links a")).toHaveText(/Market map/);
  });

  test("if a move can't be saved, the stage stays and the letter says so", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    board.stageDown = true;
    await page.locator("#stage-forward").click();
    await page.locator("#stage-yes").click();
    await expect(page.locator("#stage-error")).toContainText("Couldn’t move it");
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Idea");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "idea");
  });

  test("closing the letter mid-question cancels it", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    await page.locator("#stage-forward").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#letter")).toBeHidden();
    await openOnly(page);
    await expect(page.locator("#stage-confirm")).toBeHidden();
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Idea");
  });
});
