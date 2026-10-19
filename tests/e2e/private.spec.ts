import { test, expect, type Page } from "@playwright/test";
import { dreamRow, fakeServices, gioRow, settled, signInReturn, type Board } from "./fixtures";

/** A public board with one idea and one dream, so "empty" really means "only yours". */
const withPublic = (): Board => ({ rows: [{ ...gioRow, categories: ["food-drink"] }, dreamRow("dreampub1", "I could breathe underwater", ["water"])], posts: [], deletes: [], mails: 0 });
const signIn = (page: Page, email = "rez@example.com", id = "user-1") => page.goto("/" + signInReturn(email, id));
/** The Private | Public switch, top right. */
const choose = (page: Page, board: "Private" | "Public") => page.locator("#board-switch label", { hasText: board }).click();
const onPublic = (page: Page) => page.locator("#board-public");
const onPrivate = (page: Page) => page.locator("#board-mine");

test.describe("your own sky and sea", () => {
  test("signed out: the public sky, and no Public button", async ({ page }) => {
    await fakeServices(page, withPublic());
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveCount(1);
    await expect(page.locator("#board-switch")).toBeVisible(); // both words, always
    await expect(onPublic(page)).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "public");
  });

  test("signed out, choosing Private asks you to sign in; signing in then opens your own", async ({ page }) => {
    await fakeServices(page, withPublic());
    await page.goto("/");
    await choose(page, "Private");
    await expect(page.locator("#signin")).toBeVisible();
    await expect(onPublic(page)).toBeChecked(); // still public until you are signed in
    await expect(page.locator("html")).toHaveAttribute("data-mode", "public");
    await page.keyboard.press("Escape");
    await expect(page.locator("#signin")).toBeHidden();
    await page.goto("about:blank"); // the email link opens a fresh page
    await page.goto("/" + signInReturn("rez@example.com"));
    await expect(onPrivate(page)).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mine");
  });

  test("signing in opens your own sky and sea, empty at first; Public shows everyone's, and back", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    await signIn(page);
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mine");
    await expect(onPrivate(page)).toBeChecked();
    await expect(page.locator("#hero-lede")).toHaveText("Your own sky. Ideas you share here are private: only you can see them.");
    await page.waitForTimeout(600);
    await expect(page.locator(".plane")).toHaveCount(0);
    await expect(page.locator(".fish")).toHaveCount(0);
    expect(board.privateRequests?.every((r) => r.owner === "user-1")).toBe(true);
    await choose(page, "Public");
    await expect(onPublic(page)).toBeChecked();
    await expect(page.locator(".plane")).toHaveCount(1);
    await expect(page.locator(".fish")).toHaveCount(1);
    await expect(page.locator("#toast")).toHaveText("Showing everyone’s ideas and dreams.");
    await page.reload(); // the choice is remembered
    await expect(onPublic(page)).toBeChecked();
    await expect(page.locator(".plane")).toHaveCount(1);
    await choose(page, "Private");
    await expect(page.locator(".plane")).toHaveCount(0);
  });

  test("an idea shared in your own sky is private: saved to your board only, not emailed, no email asked; it gets its category", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    board.categorize = ["science"];
    await signIn(page);
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mine");
    await page.locator("#idea-btn").click(); await settled(page);
    await expect(page.locator("#note-name-label")).toHaveText("Name your idea"); // it names the idea; no one asks who you are
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
    await choose(page, "Public");
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
    await expect(onPublic(page)).toBeChecked();
    await expect(page.locator(".plane")).toHaveCount(1);
  });

  test("you name your own ideas and dreams; the name labels the bird and heads the letter", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    await signIn(page);
    await expect(page.locator("html")).toHaveAttribute("data-mode", "mine");
    await page.locator("#idea-btn").click(); await settled(page);
    await expect(page.locator("#note-name-label")).toHaveText("Name your idea");
    await expect(page.locator("#note-email")).toBeHidden();
    await page.locator("#note-name").fill("Telescope diary");
    await page.locator("#note-msg").fill("Write down what I see each night");
    await page.locator(".note-send").click();
    const bird = page.locator(".plane");
    await expect(bird.locator(".tag")).toHaveText("Telescope diary", { timeout: 8000 });
    await expect.poll(() => board.privateItems?.[0]?.name).toBe("Telescope diary");
    await page.reload();
    await expect(page.locator(".plane .tag")).toHaveText("Telescope diary");
    await page.locator(".plane").focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-from")).toHaveText("Telescope diary");
    await expect(page.locator("#letter-date")).not.toContainText("Telescope diary"); // only the date under it
    await page.keyboard.press("Escape"); await expect(page.locator("#letter")).toBeHidden();
    await choose(page, "Public"); // the public note asks who you are again
    await page.locator("#idea-btn").click(); await settled(page);
    await expect(page.locator("#note-name-label")).toHaveText("Name");
    await expect(page.locator("#note-email")).toBeVisible();
  });

  test("your own ideas have stages: Idea is a bird, In Progress a paper plane, Live an airplane; the public sky keeps its build's look", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    board.privateItems = [{ id: "mine0001", owner: "user-1", kind: "idea", name: "Bike map", message: "Riders mark potholes", links: [], stage: "idea", categories: ["city-places"], created_at: "2026-10-19T10:00:00Z" }];
    await signIn(page);
    const plane = page.locator('.plane[data-slug="mine0001"]');
    await expect(plane).toHaveAttribute("data-stage", "idea");
    await plane.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#stage-track")).toBeVisible();
    await page.locator('#stage-track label[data-stage="implementation"]').click();
    await expect(plane).toHaveAttribute("data-stage", "implementation");
    expect(board.privateItems![0]!.stage).toBe("implementation");
    await page.locator('#stage-track label[data-stage="live"]').click();
    await expect(plane).toHaveAttribute("data-stage", "live");
    expect(board.privateItems![0]!.stage).toBe("live");
  });

  test("you post updates on your own ideas, kept private; dreams have none", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    board.privateItems = [{ id: "mine0001", owner: "user-1", kind: "idea", name: "Bike map", message: "Riders mark potholes", links: [], stage: "idea", categories: ["city-places"], created_at: "2026-10-19T10:00:00Z" }];
    await signIn(page);
    await page.locator('.plane[data-slug="mine0001"]').focus(); await page.keyboard.press("Enter");
    await page.locator("#add-update").click();
    await page.locator("#update-msg").fill("Mapped 20 streets");
    await page.locator(".update-send").click();
    await expect(page.locator("#updates-list li")).toHaveCount(1);
    await expect(page.locator("#updates-list")).toContainText("Mapped 20 streets");
    expect(board.privateUpdates).toMatchObject([{ item_id: "mine0001", owner: "user-1", message: "Mapped 20 streets" }]);
    await page.keyboard.press("Escape");
    await page.reload();
    await page.locator('.plane[data-slug="mine0001"]').focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#updates-list")).toContainText("Mapped 20 streets");
  });

  test("one button shares your own idea on the public board (a copy; yours stays), and takes it down again", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    board.privateItems = [{ id: "mine0001", owner: "user-1", kind: "idea", name: "Bike map", message: "Riders mark potholes", links: [{ title: "", url: "https://map.test" }], stage: "implementation", categories: ["city-places"], created_at: "2026-10-19T10:00:00Z" }];
    await signIn(page);
    await page.locator('.plane[data-slug="mine0001"]').focus(); await page.keyboard.press("Enter");
    const globe = page.locator("#go-public-btn");
    await expect(globe).toBeVisible();
    await globe.click();
    await expect(page.locator("#go-public-q")).toContainText("Anyone will be able to read it");
    await page.locator("#go-public-name").fill("Rez");
    await page.locator("#go-public-yes").click();
    await expect(page.locator("#go-public-done")).toBeVisible();
    await expect(page.locator("#toast")).toHaveText("Shared in the public sky. Anyone can catch it now.");
    expect(board.posts).toHaveLength(1);
    const post = board.posts[0] as { id: string; name: string; message: string };
    expect(post).toMatchObject({ name: "Rez", message: "Riders mark potholes" });
    expect(post.id).not.toBe("mine0001"); // a copy with its own id
    expect(board.mails).toBe(1); // like any public post
    expect(board.privateItems![0]).toMatchObject({ public_id: post.id, stage: "implementation" }); // yours stays, and remembers it
    await page.keyboard.press("Escape"); await expect(page.locator("#letter")).toBeHidden();
    await choose(page, "Public");
    await expect(page.locator(`.plane[data-slug="${post.id}"]`)).toHaveCount(1); // in the public sky now
    await choose(page, "Private");
    await page.locator('.plane[data-slug="mine0001"]').focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#go-public-done")).toBeVisible(); // still shown as shared after switching back
    await page.locator("#go-public-down").click();
    await expect(page.locator("#toast")).toHaveText("Taken down from the public board.");
    expect(board.deletes).toEqual([{ p_id: post.id, p_key: expect.any(String) }]);
    expect(board.privateItems![0]!.public_id).toBeNull();
    await expect(page.locator("#go-public-done")).toBeHidden();
  });

  test("the share button is only in your own sky; a public idea's letter never shows it", async ({ page }) => {
    await fakeServices(page, withPublic());
    await page.goto("/");
    await page.locator(".plane").first().focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
    await expect(page.locator("#go-public-btn")).toBeHidden();
  });

  test("a dream shares into the public sea", async ({ page }) => {
    const board = await fakeServices(page, withPublic());
    board.privateItems = [{ id: "mine0002", owner: "user-1", kind: "dream", name: "School", message: "I was flying over my old school", links: [], stage: "idea", categories: ["flying"], created_at: "2026-10-19T10:00:00Z" }];
    await page.goto("/" + signInReturn("rez@example.com") );
    await page.locator("#dive-btn").click();
    await page.locator('.fish[data-slug="mine0002"]').focus(); await page.keyboard.press("Enter");
    await page.locator("#go-public-btn").click();
    await page.locator("#go-public-yes").click();
    await expect(page.locator("#toast")).toHaveText("Shared in the public sea. Anyone can open it now.");
    expect(board.posts[0]).toMatchObject({ kind: "dream", name: "Anonymous", message: "I was flying over my old school" });
  });
});
