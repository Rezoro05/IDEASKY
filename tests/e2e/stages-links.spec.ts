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
    await expect(page.locator('#stage-track label:has(input:checked)')).toContainText("Idea");
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

  test("the owner moves the idea one step at a time by picking a stage, with no question asked; its plane changes form", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    const radio = (stage: string) => page.locator(`#stage-track input[value="${stage}"]`);
    const pick = (stage: string) => page.locator(`#stage-track label[data-stage="${stage}"]`).click();
    await expect(radio("idea")).toBeChecked();
    await expect(radio("live")).toBeDisabled(); // no jumping two stages
    await pick("implementation");
    await expect(page.locator("#stage-track label:has(input:checked)")).toContainText("In Progress");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "implementation");
    expect(board.stageMoves!.at(-1)).toMatchObject({ p_stage: "implementation", p_key: expect.stringMatching(/^[0-9a-f]{32}$/) });
    await expect(radio("live")).toBeEnabled();
    await pick("live");
    await expect(page.locator("#stage-track label:has(input:checked)")).toContainText("Live");
    await expect(radio("idea")).toBeDisabled();
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "live");
    await pick("implementation"); // and back, just as directly
    await expect(page.locator("#stage-track label:has(input:checked)")).toContainText("In Progress");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "implementation");
    expect(board.stageMoves).toHaveLength(3);
  });

  test("other people's ideas show their stage and form, with no way to move them", async ({ page }) => {
    await fakeServices(page, { rows: [{ ...gioRow, stage: "live", links: [{ title: "Market map", url: "https://markets.example.com/" }] }], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "live");
    await openOnly(page);
    await expect(page.locator('#stage-track label:has(input:checked)')).toContainText("Live");
    await expect(page.locator("#stage-track input:enabled")).toHaveCount(0);
    await expect(page.locator("#letter-links a")).toHaveText(/Market map/);
  });

  test("if a move can't be saved, the stage stays and the letter says so", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    board.stageDown = true;
    await page.locator('#stage-track label[data-stage="implementation"]').click();
    await expect(page.locator("#stage-error")).toContainText("Couldn’t move it");
    await expect(page.locator('#stage-track label:has(input:checked)')).toContainText("Idea");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "idea");
  });
});
