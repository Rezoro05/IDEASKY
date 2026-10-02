import { test, expect, type Page, type Route } from "@playwright/test";
import { createHash } from "node:crypto";

/** Fake the outside world: the test build points at board.test and inbox.test (see build:test), and both are intercepted here. */
type Row = { id: string; name: string; message: string; created_at: string; stage?: string; links?: { title: string; url: string }[] };
type CommentRow = Row & { idea_id: string };
type Board = { rows: Row[]; down?: boolean; posts: unknown[]; deletes: unknown[]; mails: number; comments?: CommentRow[]; commentsDown?: boolean; commentPostsDown?: boolean; mailBodies?: string[]; likes?: { idea_id: string; liker_hash: string }[]; likesDown?: boolean; stageMoves?: unknown[]; stageDown?: boolean };
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
    if (url.includes("/rest/v1/likes") || url.includes("unlike_idea")) {
      board.likes ??= [];
      if (board.likesDown) return r.fulfill({ status: 500, body: "down" });
      if (method === "HEAD") { const id = new URL(url).searchParams.get("idea_id")!.slice(3); return r.fulfill({ status: 200, headers: { "content-range": `*/${board.likes.filter((l) => l.idea_id === id).length}`, "access-control-expose-headers": "Content-Range", "access-control-allow-origin": "*" } }); }
      if (url.includes("unlike_idea")) {
        const { p_idea_id, p_liker } = r.request().postDataJSON(), hash = createHash("sha256").update(p_liker).digest("hex");
        board.likes = board.likes.filter((l) => !(l.idea_id === p_idea_id && l.liker_hash === hash));
        return r.fulfill({ json: true });
      }
      const b = r.request().postDataJSON();
      if (board.likes.some((l) => l.idea_id === b.idea_id && l.liker_hash === b.liker_hash)) return r.fulfill({ status: 409, body: "" });
      board.likes.push(b);
      return r.fulfill({ status: 201, body: "" });
    }
    if (method === "GET") return r.fulfill({ json: board.rows });
    if (url.endsWith("/rest/v1/ideas")) {
      const body = r.request().postDataJSON();
      board.posts.push(body);
      board.rows.unshift({ id: body.id, name: body.name, message: body.message, links: body.links ?? [], stage: "idea", created_at: new Date().toISOString() });
      return r.fulfill({ status: 201, body: "" });
    }
    if (url.endsWith("/rpc/set_idea_stage")) {
      if (board.stageDown) return r.fulfill({ status: 500, body: "down" });
      const b = r.request().postDataJSON(), row = board.rows.find((x) => x.id === b.p_id);
      (board.stageMoves ??= []).push(b);
      if (row) row.stage = b.p_stage;
      return r.fulfill({ json: !!row });
    }
    if (url.endsWith("/rpc/delete_idea")) { board.deletes.push(r.request().postDataJSON()); return r.fulfill({ json: true }); }
    return r.fulfill({ status: 404 });
  });
  await page.route("https://inbox.test/**", (r) => { board.mails++; (board.mailBodies ??= []).push(r.request().postData() ?? ""); return r.fulfill({ json: { ok: true } }); });
  return board;
}
/** Wait for opening animations (the note unfolding, a letter opening) to finish, as a person would before clicking inside. */
async function settled(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity));
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

test("planes face the way they fly: heading left they are mirrored, heading right they are not", async ({ page }) => {
  const rows = ["aaaaaa1", "bbbbbb2", "cccccc3", "dddddd4", "eeeeee5", "ffffff6"].map((id, i) => ({ id, name: "A", message: "Idea " + i, created_at: `2026-09-30T1${i}:00:00Z` }));
  await fakeServices(page, { rows, posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  await expect(page.locator(".plane")).toHaveCount(6);
  const sample = () => page.$$eval(".plane", (els) => els.map((el) => {
    const r = el.getBoundingClientRect(); // the anchor moves only with flight; the drawing's box also shifts when it turns
    return { id: el.getAttribute("data-slug")!, x: r.left, y: r.top, mirrored: (el.querySelector(".body")!.getAttribute("style") ?? "").includes("scaleX(-1)") };
  }));
  const seen = { left: 0, right: 0 };
  let before = await sample();
  for (let i = 0; i < 160 && (seen.left < 3 || seen.right < 3); i++) {
    await page.waitForTimeout(150);
    const now = await sample();
    for (const p of now) {
      const q = before.find((b) => b.id === p.id);
      if (!q) continue;
      const dx = p.x - q.x, dy = p.y - q.y;
      if (Math.abs(dx) < 3 || Math.abs(dx) < 2 * Math.abs(dy)) continue; // only clearly sideways motion
      expect(p.mirrored, `plane moving ${dx < 0 ? "left" : "right"}`).toBe(dx < 0);
      seen[dx < 0 ? "left" : "right"]++;
    }
    before = now;
  }
  expect(seen.left).toBeGreaterThanOrEqual(3);
  expect(seen.right).toBeGreaterThanOrEqual(3);
});

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
    await settled(page);
  }

  test("anyone reads the thread, adds a comment (emailed to the owner), and can remove only their own", async ({ page }) => {
    const board = await fakeServices(page, gio());
    await page.goto("/");
    await openGio(page);
    await expect(page.locator("#thread-count")).toHaveText("1 comment");
    await expect(page.locator("#thread-list li")).toHaveCount(1);
    await expect(page.locator("#thread-list li").first()).toContainText("Ana");
    await expect(page.locator("#thread-list .c-remove")).toHaveCount(0);
    await page.locator("#comment-btn").click();
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

  test("a brand-new idea starts with no comments", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
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
      await page.locator("#comment-btn").click();
      await page.locator("#comment-msg").scrollIntoViewIfNeeded();
      await expect(page.locator("#comment-msg")).toBeInViewport();
    });
  });
});

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

test.describe("stages and links", () => {
  async function postWithLinks(page: Page, links: [string, string][]) {
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-msg").fill("A shared tool library");
    for (const [url, title] of links) {
      await page.locator("#add-link").click();
      const row = page.locator(".link-row").last();
      await row.locator(".link-url").fill(url);
      await row.locator(".link-title").fill(title);
    }
    await page.locator(".note-send").click();
  }
  async function openOnly(page: Page) {
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1, { timeout: 8000 });
    await plane.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
    await settled(page);
  }

  test("an idea is posted with its links, which open safely in a new tab", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, [["toolshare.example.org/plan", "Pilot plan"], ["https://github.com/someone/tools", ""]]);
    await expect.poll(() => board.posts.length).toBe(1);
    expect(board.posts[0]).toMatchObject({ links: [{ title: "Pilot plan", url: "https://toolshare.example.org/plan" }, { title: "github.com", url: "https://github.com/someone/tools" }] });
    expect(board.posts[0]).not.toHaveProperty("stage"); // the database starts every idea at "idea"
    await openOnly(page);
    const links = page.locator("#letter-links a");
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute("href", "https://toolshare.example.org/plan");
    await expect(links.first()).toHaveAttribute("target", "_blank");
    await expect(links.first()).toHaveAttribute("rel", /noopener/);
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Idea");
  });

  test("a link that isn't a web address stops the send and points at its row", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, [["example.com", ""], ["javascript:alert(1)", "Click me"]]);
    await expect(page.locator("#note-error")).toContainText("isn’t a web address");
    await expect(page.locator(".link-row").nth(1).locator(".link-url")).toBeFocused();
    await page.waitForTimeout(300);
    expect(board.posts).toHaveLength(0);
  });

  test("up to five links; a row can be removed", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    for (let i = 0; i < 5; i++) await page.locator("#add-link").click();
    await expect(page.locator(".link-row")).toHaveCount(5);
    await expect(page.locator("#add-link")).toBeHidden();
    await page.locator(".link-row .link-remove").first().click();
    await expect(page.locator(".link-row")).toHaveCount(4);
    await expect(page.locator("#add-link")).toBeVisible();
  });

  test("the owner moves the idea one step at a time, each move asked first; its plane changes form", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    await expect(page.locator("#stage-back")).toBeHidden();
    await page.locator("#stage-forward").click();
    await expect(page.locator("#stage-question")).toHaveText("Move this idea to Implementation?");
    await page.locator("#stage-cancel").click(); // changed my mind
    await expect(page.locator("#stage-confirm")).toBeHidden();
    expect(board.stageMoves ?? []).toHaveLength(0);
    await page.locator("#stage-forward").click();
    await page.locator("#stage-yes").click();
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Implementation");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "implementation");
    expect(board.stageMoves!.at(-1)).toMatchObject({ p_stage: "implementation", p_key: expect.stringMatching(/^[0-9a-f]{32}$/) });
    await page.locator("#stage-forward").click();
    await page.locator("#stage-yes").click();
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Live");
    await expect(page.locator("#stage-forward")).toBeHidden();
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "live");
    await page.locator("#stage-back").click();
    await expect(page.locator("#stage-question")).toHaveText("Move this idea to Implementation?");
  });

  test("other people's ideas show their stage and form, with no way to move them", async ({ page }) => {
    await fakeServices(page, { rows: [{ ...gioRow, stage: "live", links: [{ title: "Market map", url: "https://markets.example.com/" }] }], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "live");
    await openOnly(page);
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Live");
    await expect(page.locator("#stage-moves")).toBeHidden();
    await expect(page.locator("#letter-links a")).toHaveText(/Market map/);
  });

  test("if a move can't be saved, the stage stays and the letter says so", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    board.stageDown = true;
    await page.locator("#stage-forward").click();
    await page.locator("#stage-yes").click();
    await expect(page.locator("#stage-error")).toContainText("Couldn’t move it");
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Idea");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "idea");
  });

  test("closing the letter mid-question cancels it", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    await page.locator("#stage-forward").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#letter")).toBeHidden();
    await openOnly(page);
    await expect(page.locator("#stage-confirm")).toBeHidden();
    await expect(page.locator('#stage-track li[aria-current="step"]')).toContainText("Idea");
  });
});
