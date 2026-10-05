import { test, expect, type Page } from "@playwright/test";
import { fakeServices, settled, withGio, type Board } from "./fixtures";

test.describe("comments on visitor ideas", () => {
  const gio = (): Board => ({ ...withGio(),
    comments: [{ id: "cmt0001", idea_id: "zzzzzz1", name: "Ana", message: "Yes please", created_at: "2026-09-30T11:00:00Z" }] });
  async function openGio(page: Page) {
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1);
    await plane.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
    await settled(page);
  }

  test("anyone reads the thread, adds a comment (emailed to the owner), and can remove only their own", async ({ page }) => {
    const board = await fakeServices(page, gio());
    await page.goto("/");
    await openGio(page);
    await expect(page.locator("#comment-count")).toHaveText("1");
    await expect(page.locator("#thread-list li")).toHaveCount(1);
    await expect(page.locator("#thread-list li").first()).toContainText("Ana");
    await expect(page.locator("#thread-list .c-remove")).toHaveCount(0);
    await page.locator("#comment-btn").click();
    await page.locator("#comment-msg").fill("I'd sell khachapuri there");
    await page.locator("#comment-name").fill("Nino");
    await page.locator(".thread-send").click();
    await expect(page.locator("#comment-count")).toHaveText("2");
    const mine = page.locator("#thread-list li").nth(1);
    await expect(mine).toContainText("I'd sell khachapuri there");
    await expect(mine.locator(".c-remove")).toBeVisible();
    await expect(page.locator("#comment-msg")).toHaveValue("");
    expect(board.comments!.at(-1)).toMatchObject({ idea_id: "zzzzzz1", name: "Nino" });
    await expect.poll(() => board.mails).toBe(1);
    expect(board.mailBodies![0]).toContain("New comment on Idea1 from Nino");
    await expect(page.locator(".letter-card")).toHaveClass(/folding/, { timeout: 3000 }); // seen it land, now it folds and flies home
    await expect(page.locator("#letter")).toBeHidden();
    await openGio(page);
    await page.locator("#thread-list li").nth(1).locator(".c-remove").click();
    await expect(page.locator("#comment-count")).toHaveText("1");
    expect(board.comments).toHaveLength(1);
  });

  test("comments show at once; the comment icon opens and closes the form to write one", async ({ page }) => {
    await fakeServices(page, gio());
    await page.goto("/");
    await openGio(page);
    await expect(page.locator("#thread-list li")).toHaveCount(1);
    await expect(page.locator("#comment-count")).toHaveText("1");
    await expect(page.locator("#thread-form")).toBeHidden();
    await page.locator("#comment-btn").click();
    await expect(page.locator("#thread-form")).toBeVisible();
    await expect(page.locator("#comment-msg")).toBeFocused();
    await expect(page.locator("#comment-btn")).toHaveAttribute("aria-expanded", "true");
    await page.locator("#comment-btn").click();
    await expect(page.locator("#thread-form")).toBeHidden();
  });

  test("comments stay after reopening the idea and reloading the page", async ({ page }) => {
    await fakeServices(page, gio());
    await page.goto("/");
    await openGio(page);
    await page.locator("#comment-btn").click();
    await page.locator("#comment-msg").fill("Second thought");
    await page.locator(".thread-send").click();
    await expect(page.locator("#comment-count")).toHaveText("2");
    await page.reload();
    await openGio(page);
    await expect(page.locator("#comment-count")).toHaveText("2");
    await expect(page.locator("#thread-list li").nth(1).locator(".c-remove")).toBeVisible(); // still mine after reload
  });

  test("an empty comment asks for text; the bot trap posts nothing", async ({ page }) => {
    const board = await fakeServices(page, gio());
    await page.goto("/");
    await openGio(page);
    await page.locator("#comment-btn").click();
    await page.locator(".thread-send").click();
    await expect(page.locator("#comment-error")).toHaveText("Write your comment first.");
    await page.locator("#comment-msg").fill("spam");
    await page.locator('#thread-form input[name="_gotcha"]').evaluate((el: HTMLInputElement) => { el.value = "bot"; });
    await page.locator(".thread-send").click();
    await page.waitForTimeout(300);
    expect(board.comments).toHaveLength(1);
    expect(board.mails).toBe(0);
  });

  test("if a comment can't be saved, the letter stays open and keeps the text", async ({ page }) => {
    await fakeServices(page, { ...gio(), commentPostsDown: true });
    await page.goto("/");
    await openGio(page);
    await page.locator("#comment-btn").click();
    await page.locator("#comment-msg").fill("Keep me");
    await page.locator(".thread-send").click();
    await expect(page.locator("#comment-error")).toContainText("Couldn’t post your comment");
    await page.waitForTimeout(1500);
    await expect(page.locator("#letter")).toBeVisible();
    await expect(page.locator(".letter-card")).not.toHaveClass(/folding/);
    await expect(page.locator("#comment-msg")).toHaveValue("Keep me");
  });

  test("if comments can't load, the letter says so and hides the form", async ({ page }) => {
    await fakeServices(page, { ...gio(), commentsDown: true });
    await page.goto("/");
    await openGio(page);
    await expect(page.locator("#thread-status")).toContainText("couldn’t load");
    await expect(page.locator("#thread-form")).toBeHidden();
    await expect(page.locator("#comment-btn")).toBeDisabled();
  });

  test("a brand-new idea starts with no comments, and no empty Comments heading until the icon opens the form", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-msg").fill("Fresh idea");
    await page.locator(".note-send").click();
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1, { timeout: 8000 });
    await plane.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#comment-count")).toHaveText("");
    await expect(page.locator("#thread")).toBeHidden();
    await page.locator("#comment-btn").click();
    await expect(page.locator("#thread")).toBeVisible();
    await expect(page.locator("#comment-msg")).toBeFocused();
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("the letter with comments fits and scrolls inside", async ({ page }) => {
      await fakeServices(page, gio());
      await page.goto("/");
      await openGio(page);
      const card = (await page.locator(".letter-card").boundingBox())!;
      expect(card.width).toBeLessThanOrEqual(390);
      await page.locator("#comment-btn").click();
      await page.locator("#comment-msg").scrollIntoViewIfNeeded();
      await expect(page.locator("#comment-msg")).toBeInViewport();
    });
  });
});

test.describe("replies and likes on comments", () => {
  const ana = (): Board => ({ ...withGio(),
    comments: [{ id: "cmt0001", idea_id: "zzzzzz1", name: "Ana", message: "Yes please", created_at: "2026-09-30T11:00:00Z" }] });
  async function openGio(page: Page) {
    await expect(page.locator(".plane")).toHaveCount(1);
    await page.locator(".plane").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
    await settled(page);
  }
  const top = (page: Page) => page.locator("#thread-list > li");
  const replies = (page: Page, i = 0) => top(page).nth(i).locator(".replies > li");

  test("a reply shows under the comment it answers, and a reply to a reply joins the same group", async ({ page }) => {
    const board = await fakeServices(page, ana());
    await page.goto("/");
    await openGio(page);
    await top(page).first().locator(".c-reply").click();
    await expect(page.locator("#thread-form")).toBeVisible();
    await expect(page.locator("#reply-to")).toContainText("Replying to Ana");
    await page.locator("#comment-msg").fill("Me too");
    await page.locator(".thread-send").click();
    await expect(replies(page)).toHaveCount(1);
    await expect(replies(page).first()).toContainText("Me too");
    await expect(page.locator("#reply-to")).toBeHidden(); // done replying
    expect(board.comments!.at(-1)).toMatchObject({ message: "Me too", parent_id: "cmt0001" });
    await expect(page.locator("#comment-count")).toHaveText("2"); // the icon counts replies too
    // answering the reply files under Ana's comment, one level deep
    await replies(page).first().locator(".c-reply").click();
    await page.locator("#comment-msg").fill("And me");
    await page.locator(".thread-send").click();
    await expect(replies(page)).toHaveCount(2);
    expect(board.comments!.at(-1)).toMatchObject({ message: "And me", parent_id: "cmt0001" });
    await expect(top(page)).toHaveCount(1);
  });

  test("a reply can be cancelled: the comment then posts on its own", async ({ page }) => {
    const board = await fakeServices(page, ana());
    await page.goto("/");
    await openGio(page);
    await top(page).first().locator(".c-reply").click();
    await page.locator("#reply-to .reply-cancel").click();
    await expect(page.locator("#reply-to")).toBeHidden();
    await page.locator("#comment-msg").fill("Separate thought");
    await page.locator(".thread-send").click();
    await expect(top(page)).toHaveCount(2);
    expect(board.comments!.at(-1)!.parent_id).toBeNull();
  });

  test("replies stay under their comment after a reload", async ({ page }) => {
    const board = ana(); board.comments!.push({ id: "rep0001", idea_id: "zzzzzz1", parent_id: "cmt0001", name: "Bo", message: "Agreed", created_at: "2026-09-30T12:00:00Z" });
    await fakeServices(page, board);
    await page.goto("/");
    await openGio(page);
    await expect(top(page)).toHaveCount(1);
    await expect(replies(page)).toHaveCount(1);
    await expect(replies(page).first()).toContainText("Bo");
  });

  test("a comment can be liked once from a browser and unliked; the count stays after a reload", async ({ page }) => {
    const board = await fakeServices(page, ana());
    await page.goto("/");
    await openGio(page);
    const heart = top(page).first().locator(".c-like");
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await expect(heart.locator(".c-like-count")).toHaveText("1");
    await expect.poll(() => board.commentLikes?.length ?? 0).toBe(1);
    await page.reload();
    await openGio(page);
    await expect(top(page).first().locator(".c-like")).toHaveAttribute("aria-pressed", "true");
    await expect(top(page).first().locator(".c-like-count")).toHaveText("1");
    await top(page).first().locator(".c-like").click();
    await expect(top(page).first().locator(".c-like")).toHaveAttribute("aria-pressed", "false");
    await expect(top(page).first().locator(".c-like-count")).toHaveText("");
    await expect.poll(() => board.commentLikes?.length).toBe(0);
  });

  test("removing your comment takes its replies with it", async ({ page }) => {
    const board = await fakeServices(page, ana());
    await page.goto("/");
    await openGio(page);
    await page.locator("#comment-btn").click();
    await page.locator("#comment-msg").fill("Mine");
    await page.locator(".thread-send").click();
    await expect(top(page)).toHaveCount(2);
    await top(page).nth(1).locator(".c-reply").click();
    await page.locator("#comment-msg").fill("A reply to mine");
    await page.locator(".thread-send").click();
    await expect(replies(page, 1)).toHaveCount(1);
    await top(page).nth(1).locator(":scope > .c-actions .c-remove").click();
    await expect(top(page)).toHaveCount(1);
    await expect(page.locator("#comment-count")).toHaveText("1");
    expect(board.comments!.map((x) => x.message)).toEqual(["Yes please"]);
  });
});
