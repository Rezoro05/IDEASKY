import { test, expect } from "@playwright/test";
import { fakeServices, settled } from "./fixtures";

test("post an idea: it flies to the sky, opens as a letter, and its author can remove it", async ({ page }) => {
  const board = await fakeServices(page);
  await page.goto("/");
  await page.locator("#idea-btn").click(); await settled(page);
  await page.locator("#note-name").fill("Nino");
  await page.locator("#note-email").fill("nino@");
  await page.locator("#note-msg").fill("A bike-share for Tbilisi hills");
  await page.locator(".note-send").click();
  await expect(page.locator("#compose")).toBeHidden();
  const plane = page.locator(".plane");
  await expect(plane).toHaveCount(1, { timeout: 8000 });
  await expect(plane).toHaveAttribute("aria-label", "Idea1: open the idea");
  expect(await plane.locator(".body").evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe("fresh-ring"); // just posted: it pulses a ring
  expect(board.posts).toHaveLength(1);
  expect(board.posts[0]).toMatchObject({ name: "Nino", message: "A bike-share for Tbilisi hills" });
  expect(JSON.stringify(board.posts[0])).not.toContain("nino@"); // email never goes to the public board
  expect(board.mails).toBe(1);
  await plane.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#letter")).toBeVisible();
  await expect(page.locator("#letter-body")).toHaveText("A bike-share for Tbilisi hills");
  await expect(page.locator("#letter-date")).toHaveText(/^Nino/);
  await page.locator("#letter-remove").click(); // the bin asks first
  await expect(page.locator("#remove-question")).toHaveText("Remove this idea for good?");
  await expect(page.locator("#remove-cancel")).toBeFocused();
  await page.locator("#remove-cancel").click();
  await expect(page.locator("#remove-confirm")).toBeHidden();
  await page.waitForTimeout(200);
  expect(board.deletes).toHaveLength(0);
  await page.locator("#letter-remove").click();
  await page.locator("#remove-yes").click();
  await expect(page.locator("#letter")).toBeHidden();
  await expect(plane).toHaveCount(0);
  expect(board.deletes).toHaveLength(1);
});

test("closing the Idea Note right after opening it closes it for good", async ({ page }) => {
  await fakeServices(page);
  await page.goto("/");
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      document.getElementById("idea-btn")!.click();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    await page.waitForTimeout(100);
    await expect(page.locator("#compose")).toBeHidden();
    await expect(page.locator("#compose")).not.toHaveClass(/\bopen\b/);
  }
});

test("if the board is down, the idea still flies and the visitor is told", async ({ page }) => {
  await fakeServices(page, { rows: [], down: true, posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  await page.locator("#idea-btn").click(); await settled(page);
  await page.locator("#note-msg").fill("Still here");
  await page.locator(".note-send").click();
  await expect(page.locator("#toast")).toContainText("couldn’t save your idea just now");
  await expect(page.locator(".plane")).toHaveCount(1, { timeout: 8000 });
});

test("the button opens the Idea Note; it needs an idea; Escape closes it", async ({ page }) => {
  await fakeServices(page);
  await page.goto("/");
  await page.locator("#idea-btn").click(); await settled(page);
  await expect(page.locator("#compose")).toBeVisible();
  await expect(page.locator("#note-msg")).toBeFocused();
  await page.locator("#compose .note-send").click();
  await expect(page.locator("#note-error")).toHaveText("Write your idea first.");
  await page.keyboard.press("Escape");
  await expect(page.locator("#compose")).toBeHidden();
  await expect(page.locator("#idea-btn")).toBeFocused();
});

test("bots that fill the hidden field are ignored", async ({ page }) => {
  const board = await fakeServices(page);
  await page.goto("/");
  await page.locator("#idea-btn").click(); await settled(page);
  await page.locator("#note-msg").fill("spam");
  await page.locator('#note-form input[name="_gotcha"]').evaluate((el: HTMLInputElement) => { el.value = "bot"; });
  await page.locator(".note-send").click();
  await page.waitForTimeout(500);
  expect(board.posts).toHaveLength(0);
  expect(board.mails).toBe(0);
});
