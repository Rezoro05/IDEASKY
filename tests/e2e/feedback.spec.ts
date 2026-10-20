import { test, expect } from "@playwright/test";
import { fakeServices, settled } from "./fixtures";

test.describe("feedback", () => {
  test("the Feedback button is bottom left in the sky and in the sea", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    const at = async () => (await page.locator("#feedback-btn").boundingBox())!;
    const sky = await at();
    expect(sky.x).toBeLessThan(80);
    expect(sky.y).toBeGreaterThan(page.viewportSize()!.height - 120);
    await page.locator("#dive-btn").click();
    await expect(page.locator("html")).toHaveAttribute("data-depth", "sea");
    await expect(page.locator("#feedback-btn")).toBeInViewport();
  });

  test("Feedback (bottom left) opens a private note; sending saves it for the owner's email, folds the note away and says thanks", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/#sea");
    await page.locator("#feedback-btn").click(); await settled(page);
    await expect(page.locator("#feedback")).toBeVisible();
    await expect(page.locator("#feedback .note-to")).toHaveText("Private");
    await expect(page.locator("#feedback-msg")).toBeFocused();
    await page.locator("#feedback-msg").fill("The bar is lovely, but dragging on my phone felt sticky");
    await page.locator("#feedback-email").fill("rez@example.com");
    await page.locator("#feedback-form .feedback-send").click();
    await expect(page.locator("#feedback")).toBeHidden({ timeout: 4000 });
    await expect(page.locator("#toast")).toHaveText("Thanks. Your feedback is on its way.");
    expect(board.feedback).toHaveLength(1); // the board emails it to the owner (supabase/functions/notify)
    expect(board.feedback![0]).toMatchObject({ message: "The bar is lovely, but dragging on my phone felt sticky", email: "rez@example.com" });
    expect(board.posts).toHaveLength(0); // feedback never reaches the public board
    await expect(page.locator(".plane")).toHaveCount(0);
  });

  test("an empty note asks for the feedback and sends nothing; closing it, with Escape or outside, throws nothing away silently", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/#sea");
    await page.locator("#feedback-btn").click(); await settled(page);
    await page.locator("#feedback-form .feedback-send").click();
    await expect(page.locator("#feedback-error")).toHaveText("Write your feedback first.");
    await expect(page.locator("#feedback-msg")).toBeFocused();
    expect(board.feedback ?? []).toHaveLength(0);
    await page.keyboard.press("Escape");
    await expect(page.locator("#feedback")).toBeHidden();
    await expect(page.locator("#feedback-btn")).toBeFocused();
    await page.locator("#feedback-btn").click(); await settled(page);
    await expect(page.locator("#feedback-msg")).toHaveValue(""); // a fresh note each time
    await page.mouse.click(8, 8);
    await expect(page.locator("#feedback")).toBeHidden();
  });

  test("if the email can't be sent, the note stays open with the text and says so", async ({ page }) => {
    await fakeServices(page);
    await page.route("https://board.test/rest/v1/feedback", (r) => r.fulfill({ status: 500, body: "down" }));
    await page.goto("/#sea");
    await page.locator("#feedback-btn").click(); await settled(page);
    await page.locator("#feedback-msg").fill("Please keep this text");
    await page.locator("#feedback-form .feedback-send").click();
    await expect(page.locator("#feedback-error")).toContainText("Couldn’t send your feedback");
    await expect(page.locator("#feedback")).toBeVisible();
    await expect(page.locator("#feedback-msg")).toHaveValue("Please keep this text");
    await expect(page.locator("#feedback-form .feedback-send")).toBeEnabled(); // can try again
  });

  test("the bot trap sends nothing and looks like nothing happened", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/#sea");
    await page.locator("#feedback-btn").click(); await settled(page);
    await page.locator("#feedback-msg").fill("buy cheap pills");
    await page.locator("#feedback-form input[name=_gotcha]").evaluate((el: HTMLInputElement) => { el.value = "x"; });
    await page.locator("#feedback-form .feedback-send").click();
    await page.waitForTimeout(400);
    expect(board.feedback ?? []).toHaveLength(0);
    await expect(page.locator("#feedback-error")).toBeHidden();
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("the Feedback button fits the screen, and so does the note", async ({ page }) => {
      await fakeServices(page);
      await page.goto("/#sea");
      const link = (await page.locator("#feedback-btn").boundingBox())!;
      expect(link.y + link.height).toBeLessThanOrEqual(844);
      expect(link.x).toBeGreaterThanOrEqual(0);
      await page.locator("#feedback-btn").click(); await settled(page);
      const card = (await page.locator("#feedback-form").boundingBox())!;
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(390);
      expect(card.y + card.height).toBeLessThanOrEqual(844);
    });
  });
});
