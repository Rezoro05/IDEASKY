import { test, expect, type Page } from "@playwright/test";
import { fakeServices, withGio } from "./fixtures";

test("other people's ideas can be read but not removed", async ({ page }) => {
  await fakeServices(page, withGio());
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveCount(1);
  await plane.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#letter-body")).toHaveText("Night markets");
  await expect(page.locator("#letter-remove")).toBeHidden();
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
