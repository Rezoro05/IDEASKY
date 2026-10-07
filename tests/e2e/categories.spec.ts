import { test, expect } from "@playwright/test";
import { fakeServices, gioRow, settled, watchErrors } from "./fixtures";

test.describe("categories (set by Jev)", () => {
  test("an open idea shows its category tags", async ({ page }) => {
    await fakeServices(page, { rows: [{ ...gioRow, categories: ["food-drink", "city-places"] }], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1);
    await plane.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-cats li")).toHaveText(["Food & Drink", "City & Places"]);
    await settled(page);
    const who = (await page.locator("#letter-date").boundingBox())!, tags = (await page.locator("#letter-cats").boundingBox())!;
    expect(Math.abs((who.y + who.height / 2) - (tags.y + tags.height / 2))).toBeLessThan(8); // on the author and date's line…
    expect(tags.x).toBeGreaterThan(who.x + who.width); // …on the right
  });

  test("an idea not sorted yet, or that fits nothing, shows no tags", async ({ page }) => {
    await fakeServices(page, { rows: [{ ...gioRow, categories: [] }], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    await page.locator(".plane").focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
    await expect(page.locator("#letter-cats")).toBeHidden();
  });

  test("a new idea is sorted once it's saved, and its letter shows the tags", async ({ page }) => {
    const board = await fakeServices(page);
    board.categorize = ["tech", "science"];
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-msg").fill("A telescope app that names the stars you point at");
    await page.locator(".note-send").click();
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1, { timeout: 8000 });
    await expect.poll(() => board.categorizeCalls?.length ?? 0).toBe(1);
    expect(board.categorizeCalls![0]).toBe((board.posts[0] as { id: string }).id);
    await plane.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-cats li")).toHaveText(["Tech", "Science"]);
  });

  test("if sorting fails, the idea is still posted and nothing breaks", async ({ page }) => {
    const board = await fakeServices(page);
    board.categorizeDown = true;
    const errors = watchErrors(page);
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-msg").fill("Night markets in every borough");
    await page.locator(".note-send").click();
    await expect(page.locator(".plane")).toHaveCount(1, { timeout: 8000 });
    await expect.poll(() => board.categorizeCalls?.length ?? 0).toBe(1);
    await page.locator(".plane").focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-body")).toHaveText("Night markets in every borough");
    await expect(page.locator("#letter-cats")).toBeHidden();
    expect(errors.filter((e) => !e.includes("502"))).toEqual([]); // the failed request itself is logged by the browser; nothing else
  });
});
