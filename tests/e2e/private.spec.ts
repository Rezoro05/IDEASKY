import { test, expect, type Page } from "@playwright/test";
import { dreamRow, fakeServices, gioRow, settled, signInReturn, type Board } from "./fixtures";

/** A public board with one idea and one dream, so "empty" really means "only yours". */
const withPublic = (): Board => ({ rows: [{ ...gioRow, categories: ["food-drink"] }, dreamRow("dreampub1", "I could breathe underwater", ["water"])], posts: [], deletes: [], mails: 0 });
const signIn = (page: Page, email = "rez@example.com", id = "user-1") => page.goto("/" + signInReturn(email, id));
const publicBtn = (page: Page) => page.locator("#account-public");

test.describe("your own sky and sea", () => {
  test("signed out: the public sky, and no Public button", async ({ page }) => {
    await fakeServices(page, withPublic());
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveCount(1);
    await expect(publicBtn(page)).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "public");
  });

  test("signing in opens your own sky and sea, empty at first; Public shows everyone's, and back", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    await signIn(page);
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mine");
    await expect(publicBtn(page)).toBeVisible();
    await expect(publicBtn(page)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#hero-lede")).toHaveText("Your own sky. Ideas you share here are private: only you can see them.");
    await page.waitForTimeout(600);
    await expect(page.locator(".plane")).toHaveCount(0);
    await expect(page.locator(".fish")).toHaveCount(0);
    expect(board.privateRequests?.every((r) => r.owner === "user-1")).toBe(true);
    await publicBtn(page).click();
    await expect(publicBtn(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".plane")).toHaveCount(1);
    await expect(page.locator(".fish")).toHaveCount(1);
    await expect(page.locator("#toast")).toHaveText("Showing everyone’s ideas and dreams.");
    await page.reload(); // the choice is remembered
    await expect(publicBtn(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".plane")).toHaveCount(1);
    await publicBtn(page).click();
    await expect(page.locator(".plane")).toHaveCount(0);
  });

  test("an idea shared in your own sky is private: saved to your board only, not emailed, no name asked; it gets its category", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    board.categorize = ["science"];
    await signIn(page);
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mine");
    await page.locator("#idea-btn").click(); await settled(page);
    await expect(page.locator("#note-name")).toBeHidden();
    await expect(page.locator("#note-email")).toBeHidden();
    await page.locator("#note-msg").fill("A private telescope diary");
    await page.locator(".note-send").click();
    const bird = page.locator(".plane");
    await expect(bird).toHaveCount(1, { timeout: 8000 });
    await expect.poll(() => board.privateItems?.length ?? 0).toBe(1);
    expect(board.privateItems![0]).toMatchObject({ owner: "user-1", kind: "idea", message: "A private telescope diary", name: "" });
    expect(board.posts).toEqual([]); // nothing went to the public board
    expect(board.mails).toBe(0); // and nothing was emailed
    await expect(bird).toHaveAttribute("data-flock", "science");
    await publicBtn(page).click();
    await expect(page.locator(`.plane[data-slug="${board.privateItems![0]!.id}"]`)).toHaveCount(0); // not in the public sky
  });

  test("a dream shared in your own sea is private too", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    await page.goto("/" + signInReturn("rez@example.com"));
    await page.locator("#dive-btn").click();
    await expect(page.locator("#sea-lede")).toHaveText("Your own sea. Dreams you share here are private: only you can see them.");
    await page.locator("#dream-btn").click(); await settled(page);
    await page.locator("#note-msg").fill("I was flying over my old school");
    await page.locator(".note-send").click();
    await expect.poll(() => board.privateItems?.length ?? 0).toBe(1);
    expect(board.privateItems![0]).toMatchObject({ owner: "user-1", kind: "dream" });
    expect(board.posts).toEqual([]);
    await expect(page.locator(".fish")).toHaveCount(1, { timeout: 8000 });
  });

  test("your own idea opens without likes, comments or sharing, and you can remove it", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    board.privateItems = [{ id: "mine0001", owner: "user-1", kind: "idea", name: "", message: "Only mine", links: [], stage: "idea", categories: ["tech"], created_at: "2026-10-19T10:00:00Z" }];
    await signIn(page);
    const bird = page.locator('.plane[data-slug="mine0001"]');
    await expect(bird).toHaveCount(1);
    await bird.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-body")).toHaveText("Only mine");
    for (const id of ["#like-btn", "#comment-btn", "#share-btn"]) await expect(page.locator(id)).toBeHidden();
    await page.locator("#letter-remove").click();
    await page.locator("#remove-yes").click();
    await expect(page.locator("#letter")).toBeHidden();
    expect(board.privateItems).toEqual([]);
    await expect(bird).toHaveCount(0);
  });

  test("someone else signed in sees none of yours; signing out goes back to the public sky", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    board.privateItems = [{ id: "mine0001", owner: "user-1", kind: "idea", name: "", message: "Only mine", links: [], stage: "idea", categories: ["tech"], created_at: "2026-10-19T10:00:00Z" }];
    await signIn(page, "other@example.com", "user-2");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mine");
    await page.waitForTimeout(600);
    await expect(page.locator(".plane")).toHaveCount(0);
    await page.locator("#account-me").click();
    await page.locator("#account-signout").click();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "public");
    await expect(publicBtn(page)).toBeHidden();
    await expect(page.locator(".plane")).toHaveCount(1);
  });
});
