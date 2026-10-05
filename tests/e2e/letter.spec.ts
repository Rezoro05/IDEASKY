import { test, expect, type Page } from "@playwright/test";
import { fakeServices, withGio } from "./fixtures";

test("other people's ideas can be read but not removed; the owner row stays out of sight", async ({ page }) => {
  await fakeServices(page, withGio());
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveCount(1);
  await plane.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#letter-body")).toHaveText("Night markets");
  await expect(page.locator("#letter-remove")).toBeHidden();
  await expect(page.locator(".owner")).toBeHidden();
  await expect(page.locator("#add-update")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("#letter")).toBeHidden();
});

for (const [how, close] of [
  ["Escape", (page: Page) => page.keyboard.press("Escape")],
  ["the close button", (page: Page) => page.locator("#letter-close").click()],
  ["clicking outside", (page: Page) => page.mouse.click(8, 8)],
] as const) {
  test(`closing a letter with ${how} folds it into a plane that flies home to the sky`, async ({ page }) => {
    await fakeServices(page, withGio());
    await page.goto("/");
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1);
    await plane.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter-body")).toHaveText("Night markets");
    await expect(page.locator("#letter-refold")).toHaveCount(0); // closing is the fold
    await close(page);
    await expect(page.locator(".letter-card")).toHaveClass(/folding/);
    await expect(page.locator(".note-flier")).toHaveCount(1, { timeout: 3000 });
    await expect(page.locator("#letter")).toBeHidden();
    await expect(page.locator(".note-flier")).toHaveCount(0, { timeout: 6000 }); // merged into its plane
    await expect(plane).toHaveCount(1);
  });
}

test("closing the letter right after opening it closes it for good", async ({ page }) => {
  await fakeServices(page, withGio());
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveCount(1);
  await plane.focus();
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      document.querySelector<HTMLElement>(".plane")!.click();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); // before the opening animation's frames run
    });
    await expect(page.locator("#letter")).toBeHidden();
  }
});

test("the share icon copies a link to this idea on a desktop and says so", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await fakeServices(page, withGio());
  await page.goto("/");
  await page.locator(".plane").focus();
  await page.keyboard.press("Enter");
  await page.locator("#share-btn").click();
  await expect(page.locator("#share-status")).toHaveText("Link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url().split("#")[0] + "#idea-zzzzzz1");
  await expect(page.locator("#share-status")).toHaveText("", { timeout: 4000 });
});

test("a link to an idea opens that idea", async ({ page }) => {
  await fakeServices(page, withGio());
  await page.goto("/#idea-zzzzzz1");
  await expect(page.locator("#letter")).toBeVisible();
  await expect(page.locator("#letter-body")).toHaveText("Night markets");
});

test("closing an idea opened from a link takes the link off the address, so a reload doesn't open it again", async ({ page }) => {
  await fakeServices(page, withGio());
  await page.goto("/#idea-zzzzzz1");
  await expect(page.locator("#letter")).toBeVisible();
  await page.waitForTimeout(400); // the letter's opening animation
  await page.keyboard.press("Escape");
  await expect(page.locator("#letter")).toBeHidden();
  expect(new URL(page.url()).hash).toBe("");
});

test("a link to an idea that is gone says so instead of opening nothing", async ({ page }) => {
  await fakeServices(page, withGio());
  await page.goto("/#idea-gone0001");
  await expect(page.locator("#toast")).toContainText("isn’t on the board");
  await expect(page.locator("#letter")).toBeHidden();
});
