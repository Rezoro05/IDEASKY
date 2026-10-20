import { test, expect, type Page } from "@playwright/test";
import { fakeServices, settled, signInReturn, type Board } from "./fixtures";

/** Public posts that belong to an account: posted while signed in, or made here before signing in and claimed with their keys. */
const empty = (): Board => ({ rows: [], posts: [], deletes: [] });
const toPublic = (page: Page) => page.locator("#board-switch label", { hasText: "Public" }).click();
async function postIdea(page: Page, message: string) {
  await page.locator("#idea-btn").click(); await settled(page);
  await page.locator("#note-msg").fill(message);
  await page.locator(".note-send").click();
}
async function openIdea(page: Page, id: string) {
  const bird = page.locator(`.plane[data-slug="${id}"]`);
  await expect(bird).toHaveCount(1, { timeout: 8000 });
  await bird.focus(); await page.keyboard.press("Enter");
}

test.describe("public posts that belong to your account", () => {
  test("posted while signed in, it can be removed from another browser where you are signed in", async ({ browser }) => {
    const first = await browser.newPage();
    const board = await fakeServices(first, empty());
    await first.goto("/" + signInReturn("rez@example.com"));
    await toPublic(first);
    await postIdea(first, "Rooftop gardens for every school");
    await expect.poll(() => board.posts.length).toBe(1);
    const id = (board.posts[0] as { id: string }).id;
    expect(board.owners).toEqual({ [id]: "user-1" }); // sent with your sign-in: the database makes it yours
    await first.close();

    const second = await browser.newPage(); // another browser: none of the first one's keys
    await fakeServices(second, board);
    await second.goto("/" + signInReturn("rez@example.com"));
    await toPublic(second);
    await openIdea(second, id);
    await expect(second.locator("#letter-body")).toHaveText("Rooftop gardens for every school");
    await expect(second.locator("#letter-remove")).toBeVisible(); // yours by account
    await second.locator("#letter-remove").click();
    await second.locator("#remove-yes").click();
    await expect(second.locator("#letter")).toBeHidden();
    expect(board.deletes).toEqual([{ p_id: id, p_key: null }]); // no key in this browser: your sign-in proved it
    await second.close();
  });

  test("someone else signed in can't remove it; a post made here before signing in joins your account", async ({ browser }) => {
    const page = await browser.newPage();
    const board = await fakeServices(page, empty());
    await page.goto("/");
    await postIdea(page, "Made before signing in");
    await expect.poll(() => board.posts.length).toBe(1);
    const id = (board.posts[0] as { id: string }).id;
    await expect.poll(() => page.evaluate((i) => !!JSON.parse(localStorage.getItem("idea-delete-keys") ?? "{}")[i], id)).toBe(true); // its key is kept here
    expect(board.owners ?? {}).toEqual({}); // signed out: nobody's yet
    await page.goto("about:blank");
    await page.goto("/" + signInReturn("rez@example.com"));
    await expect.poll(() => board.owners?.[id]).toBe("user-1"); // claimed with this browser's key
    await page.close();

    const stranger = await browser.newPage();
    await fakeServices(stranger, board);
    await stranger.goto("/" + signInReturn("ana@example.com", "user-2"));
    await toPublic(stranger);
    await openIdea(stranger, id);
    await expect(stranger.locator("#letter-body")).toHaveText("Made before signing in");
    await expect(stranger.locator("#letter-remove")).toBeHidden();
    await stranger.close();
  });
});
