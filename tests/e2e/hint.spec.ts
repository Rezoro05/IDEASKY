import { test, expect } from "@playwright/test";
import { fakeServices, gioRow } from "./fixtures";

test.describe("the first-visit hint", () => {
  test("a first visit shows how to catch a bird and drop it in the cage; the next visit doesn't", async ({ page }) => {
    await fakeServices(page, { rows: [{ ...gioRow }], posts: [], deletes: [], mails: 0, firstVisit: true });
    await page.goto("/");
    const tour = page.locator(".cage-hint-tour");
    await expect(tour).toHaveCount(1, { timeout: 4000 });
    await expect(tour.locator(".ht-label")).toHaveText(["1 · PRESS A BIRD", "2 · DRAG", "3 · DROP IN THE CAGE"]);
    expect(await tour.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none"); // it never gets in the way
    await expect(tour).toHaveCount(0, { timeout: 14_000 }); // twice through, then it fades
    await page.reload();
    await page.waitForTimeout(2500);
    await expect(page.locator(".cage-hint-tour")).toHaveCount(0);
  });

  test("any press ends it at once", async ({ page }) => {
    await fakeServices(page, { rows: [], posts: [], deletes: [], mails: 0, firstVisit: true });
    await page.goto("/");
    await expect(page.locator(".cage-hint-tour")).toHaveCount(1, { timeout: 4000 });
    await page.mouse.click(600, 600);
    await expect(page.locator(".cage-hint-tour")).toHaveCount(0, { timeout: 1500 });
  });

  test("a visit that starts in the sea, or at an idea, skips it", async ({ page }) => {
    await fakeServices(page, { rows: [], posts: [], deletes: [], mails: 0, firstVisit: true });
    await page.goto("/#sea");
    await page.waitForTimeout(2500);
    await expect(page.locator(".cage-hint-tour")).toHaveCount(0);
  });
});
