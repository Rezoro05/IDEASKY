import { test, expect, type Page, type Route } from "@playwright/test";

/** Fake the outside world: the test build points at board.test and inbox.test (see build:test), and both are intercepted here. */
type Row = { id: string; name: string; message: string; created_at: string };
type CommentRow = Row & { idea_id: string };
type Board = { rows: Row[]; down?: boolean; posts: unknown[]; deletes: unknown[]; mails: number; comments?: CommentRow[]; commentsDown?: boolean; commentPostsDown?: boolean; mailBodies?: string[] };
async function fakeServices(page: Page, board: Board = { rows: [], posts: [], deletes: [], mails: 0 }) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("https://board.test/**", async (r: Route) => {
    if (board.down) return r.fulfill({ status: 500, body: "down" });
    const url = r.request().url(), method = r.request().method();
    if (url.includes("/rest/v1/comments") || url.includes("delete_comment")) {
      board.comments ??= [];
      if (board.commentsDown) return r.fulfill({ status: 500, body: "down" });
      if (method === "GET") { const id = new URL(url).searchParams.get("idea_id")!.slice(3); return r.fulfill({ json: board.comments.filter((x) => x.idea_id === id) }); }
      if (board.commentPostsDown) return r.fulfill({ status: 500, body: "down" });
      if (url.includes("delete_comment")) { const { p_id } = r.request().postDataJSON(); board.comments = board.comments.filter((x) => x.id !== p_id); return r.fulfill({ json: true }); }
      const b = r.request().postDataJSON();
      board.comments.push({ id: b.id, idea_id: b.idea_id, name: b.name, message: b.message, created_at: new Date().toISOString() });
      return r.fulfill({ status: 201, body: "" });
    }
    if (method === "GET") return r.fulfill({ json: board.rows });
    if (url.endsWith("/rest/v1/ideas")) {
      const body = r.request().postDataJSON();
      board.posts.push(body);
      board.rows.unshift({ id: body.id, name: body.name, message: body.message, created_at: new Date().toISOString() });
      return r.fulfill({ status: 201, body: "" });
    }
    if (url.endsWith("/rpc/delete_idea")) { board.deletes.push(r.request().postDataJSON()); return r.fulfill({ json: true }); }
    return r.fulfill({ status: 404 });
  });
  await page.route("https://inbox.test/**", (r) => { board.mails++; (board.mailBodies ??= []).push(r.request().postData() ?? ""); return r.fulfill({ json: { ok: true } }); });
  return board;
}
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  return errors;
}

const gioRow = { id: "zzzzzz1", name: "Gio", message: "Night markets", created_at: "2026-09-30T10:00:00Z" };
const withGio = (): Board => ({ rows: [{ ...gioRow }], posts: [], deletes: [], mails: 0 });

test("the home page opens with IDEA SKY content and no errors", async ({ page }) => {
  await fakeServices(page);
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle("IDEA SKY · Share ideas, bring them to life");
  await expect(page.locator("h1")).toHaveText("Ideas are everywhere.");
  await expect(page.locator(".closing")).toHaveCount(0); // one section: the sky
  await expect(page.locator(".bar")).toContainText("IDEA SKY");
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test("unknown URLs get the 404 page, which still works as the site", async ({ page }) => {
  await fakeServices(page);
  const res = await page.goto("/nope/");
  expect(res?.status()).toBe(404);
  await expect(page.locator("#field")).toBeVisible();
  await expect(page.locator("h1")).toHaveText("Ideas are everywhere.");
});

test("planes can be dragged and thrown, and a drag does not open the idea", async ({ page }) => {
  await fakeServices(page, withGio());
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveCount(1);
  await page.waitForTimeout(400);
  await plane.focus(); // pause it so we can grab it reliably
  const box = (await plane.boundingBox())!;
  const x0 = box.x + box.width / 2, y0 = box.y + box.height / 2;
  const dx = x0 > 400 ? -25 : 25;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + i * dx, y0, { steps: 1 });
  await page.mouse.up();
  await expect(page.locator("#letter")).toBeHidden();
  const after = (await plane.boundingBox())!;
  expect(Math.abs(after.x - box.x)).toBeGreaterThan(150);
});

test("a plane faces the way it flies: thrown left it is mirrored, thrown right it is not", async ({ page }) => {
  await fakeServices(page, withGio());
  await page.goto("/");
  const plane = page.locator(".plane"), body = plane.locator(".body");
  await expect(plane).toHaveCount(1);
  for (const [dx, mirrored] of [[-30, true], [30, false]] as const) {
    await plane.focus();
    const box = (await plane.boundingBox())!;
    const x0 = Math.min(Math.max(box.x + box.width / 2, 400), 880), y0 = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y0);
    await page.mouse.down();
    await page.mouse.move(x0, y0, { steps: 4 });
    for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + i * dx, y0, { steps: 1 });
    await page.mouse.up();
    await page.locator("h1").focus().catch(() => {}); // unpause
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect.poll(async () => (await body.getAttribute("style")) ?? "").toMatch(mirrored ? /scaleX\(-1\)/ : /^(?!.*scaleX)/);
  }
});

test("post an idea: it flies to the sky, opens as a letter, and its author can remove it", async ({ page }) => {
  const board = await fakeServices(page);
  await page.goto("/");
  await page.locator("#idea-btn").click();
  await page.locator("#note-name").fill("Nino");
  await page.locator("#note-email").fill("nino@");
  await page.locator("#note-msg").fill("A bike-share for Tbilisi hills");
  await page.locator(".note-send").click();
  await expect(page.locator("#compose")).toBeHidden();
  const plane = page.locator(".plane");
  await expect(plane).toHaveCount(1, { timeout: 8000 });
  await expect(plane).toHaveAttribute("aria-label", "Idea1: open the idea");
  expect(board.posts).toHaveLength(1);
  expect(board.posts[0]).toMatchObject({ name: "Nino", message: "A bike-share for Tbilisi hills" });
  expect(JSON.stringify(board.posts[0])).not.toContain("nino@"); // email never goes to the public board
  expect(board.mails).toBe(1);
  await plane.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#letter")).toBeVisible();
  await expect(page.locator("#letter-body")).toHaveText("A bike-share for Tbilisi hills");
  await expect(page.locator("#letter-date")).toContainText("From Nino");
  await page.locator("#letter-remove").click();
  await expect(page.locator("#letter")).toBeHidden();
  await expect(plane).toHaveCount(0);
  expect(board.deletes).toHaveLength(1);
});

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
    await expect(page.locator(".note-flier")).toHaveCount(0, { timeout: 3000 }); // merged into its plane
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
  await page.locator("#idea-btn").click();
  await page.locator("#note-msg").fill("Still here");
  await page.locator(".note-send").click();
  await expect(page.locator("#toast")).toContainText("couldn’t save your idea just now");
  await expect(page.locator(".plane")).toHaveCount(1, { timeout: 8000 });
});

test("the button opens the Idea Note; it needs an idea; Escape closes it", async ({ page }) => {
  await fakeServices(page);
  await page.goto("/");
  await page.locator("#idea-btn").click();
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
  await page.locator("#idea-btn").click();
  await page.locator("#note-msg").fill("spam");
  await page.locator('#note-form input[name="_gotcha"]').evaluate((el: HTMLInputElement) => { el.value = "bot"; });
  await page.locator(".note-send").click();
  await page.waitForTimeout(500);
  expect(board.posts).toHaveLength(0);
  expect(board.mails).toBe(0);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("shows the plain list instead of the sky, and it still opens ideas", async ({ page }) => {
    await fakeServices(page, withGio());
    await page.goto("/");
    await expect(page.locator("#fallback")).toBeVisible();
    await expect(page.locator(".plane")).toHaveCount(0);
    await page.locator("#ideas-list a").first().click();
    await expect(page.locator("#letter-body")).toHaveText("Night markets");
    await page.keyboard.press("Escape");
    await expect(page.locator("#letter")).toBeHidden(); // no fold or flight without motion
    await expect(page.locator(".note-flier")).toHaveCount(0);
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("the page fits the screen with no sideways scroll", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw).toBeLessThanOrEqual(cw);
  });
});

test("SEO basics: canonical, structured data, sitemap", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://rezoro05.github.io/IDEASKY/");
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld).toMatchObject({ "@type": "WebSite", name: "IDEA SKY" });
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://rezoro05.github.io/IDEASKY/</loc>");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://rezoro05.github.io/IDEASKY/sitemap.xml");
  // GitHub Pages hides folders starting with _ (like _astro/) unless .nojekyll is present
  expect((await request.get("/.nojekyll")).status()).toBe(200);
});

test.describe("comments on visitor ideas", () => {
  const gio = (): Board => ({ ...withGio(),
    comments: [{ id: "cmt0001", idea_id: "zzzzzz1", name: "Ana", message: "Yes please", created_at: "2026-09-30T11:00:00Z" }] });
  async function openGio(page: Page) {
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1);
    await plane.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
  }

  test("anyone reads the thread, adds a comment (emailed to the owner), and can remove only their own", async ({ page }) => {
    const board = await fakeServices(page, gio());
    await page.goto("/");
    await openGio(page);
    await expect(page.locator("#thread-count")).toHaveText("1 comment");
    await expect(page.locator("#thread-list li")).toHaveCount(1);
    await expect(page.locator("#thread-list li").first()).toContainText("Ana");
    await expect(page.locator("#thread-list .c-remove")).toHaveCount(0);
    await page.locator("#comment-msg").fill("I'd sell khachapuri there");
    await page.locator("#comment-name").fill("Nino");
    await page.locator(".thread-send").click();
    await expect(page.locator("#thread-count")).toHaveText("2 comments");
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
    await expect(page.locator("#thread-count")).toHaveText("1 comment");
    expect(board.comments).toHaveLength(1);
  });

  test("comments stay after reopening the idea and reloading the page", async ({ page }) => {
    await fakeServices(page, gio());
    await page.goto("/");
    await openGio(page);
    await page.locator("#comment-msg").fill("Second thought");
    await page.locator(".thread-send").click();
    await expect(page.locator("#thread-count")).toHaveText("2 comments");
    await page.reload();
    await openGio(page);
    await expect(page.locator("#thread-count")).toHaveText("2 comments");
    await expect(page.locator("#thread-list li").nth(1).locator(".c-remove")).toBeVisible(); // still mine after reload
  });

  test("an empty comment asks for text; the bot trap posts nothing", async ({ page }) => {
    const board = await fakeServices(page, gio());
    await page.goto("/");
    await openGio(page);
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
  });

  test("a brand-new idea starts with no comments", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await page.locator("#idea-btn").click();
    await page.locator("#note-msg").fill("Fresh idea");
    await page.locator(".note-send").click();
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1, { timeout: 8000 });
    await plane.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#thread-count")).toHaveText("No comments yet");
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("the letter with comments fits and scrolls inside", async ({ page }) => {
      await fakeServices(page, gio());
      await page.goto("/");
      await openGio(page);
      const card = (await page.locator(".letter-card").boundingBox())!;
      expect(card.width).toBeLessThanOrEqual(390);
      await page.locator("#comment-msg").scrollIntoViewIfNeeded();
      await expect(page.locator("#comment-msg")).toBeInViewport();
    });
  });
});
