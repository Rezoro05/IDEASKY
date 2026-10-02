import { test, expect, type Page } from "@playwright/test";
import { fakeServices, settled, withGio } from "./fixtures";

test.describe("likes", () => {
  const liked = (n: number) => Array.from({ length: n }, (_, i) => ({ idea_id: "zzzzzz1", liker_hash: String(i).padStart(64, "0") }));
  async function openIdea(page: Page) {
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1);
    await plane.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
    await settled(page);
  }

  test("anyone can like an idea once from this browser, and tap again to unlike", async ({ page }) => {
    const board = await fakeServices(page, { ...withGio(), likes: liked(2) });
    await page.goto("/");
    await openIdea(page);
    const heart = page.locator("#like-btn"), count = page.locator("#like-count");
    await expect(count).toHaveText("2");
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await expect(heart).toHaveAttribute("aria-label", "Unlike this idea");
    await expect(count).toHaveText("3");
    await expect.poll(() => board.likes!.length).toBe(3);
    expect(board.likes!.at(-1)!.liker_hash).toMatch(/^[0-9a-f]{64}$/); // only a hash leaves the browser
    await page.reload();
    await openIdea(page);
    await expect(heart).toHaveAttribute("aria-pressed", "true"); // remembered by this browser
    await expect(count).toHaveText("3");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await expect(count).toHaveText("2");
    await expect.poll(() => board.likes!.length).toBe(2);
  });

  test("if a like can't be saved, the heart goes back", async ({ page }) => {
    await fakeServices(page, { ...withGio(), likesDown: true });
    await page.goto("/");
    await openIdea(page);
    await expect(page.locator("#like-count")).toHaveText(""); // count unknown: no number
    await page.locator("#like-btn").click();
    await expect(page.locator("#like-btn")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#like-count")).toHaveText("");
  });
});
