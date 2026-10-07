import { test, expect } from "@playwright/test";
import { fakeServices, type Row } from "./fixtures";

/** Runs against the public build (stages hidden), project "public" in playwright.config.ts. */
const row = (id: string, stage: string, hoursAgo: number): Row => ({ id, name: "Gio", message: `An idea at ${stage}`, stage, created_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString() });

test.describe("the public board: ideas only, no stages", () => {
  test("every idea flies as a bird, whatever stage is stored", async ({ page }) => {
    await fakeServices(page, { rows: [row("pubidea1", "idea", 3), row("pubidea2", "implementation", 2), row("pubidea3", "live", 1)], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveCount(3);
    for (const id of ["pubidea1", "pubidea2", "pubidea3"]) await expect(page.locator(`.plane[data-slug="${id}"]`)).toHaveAttribute("data-stage", "idea");
    await expect(page.locator(".plane .bw").first()).toBeAttached(); // birds have wings
  });

  test("an open idea has no stage bar", async ({ page }) => {
    await fakeServices(page, { rows: [row("pubidea3", "live", 1)], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    await page.locator(".plane").focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-body")).toHaveText("An idea at live");
    await expect(page.locator("#stage-track")).toBeHidden();
    await expect(page.locator("#like-btn")).toBeVisible();
  });
});
