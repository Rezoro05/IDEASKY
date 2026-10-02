import { test, expect, type Page, type Route } from "@playwright/test";

/** Fake the outside world: no real Supabase, Formspree or YouTube calls from tests. */
type Row = { id: string; name: string; message: string; created_at: string };
type CommentRow = Row & { idea_id: string };
type Board = { rows: Row[]; down?: boolean; posts: unknown[]; deletes: unknown[]; mails: number; comments?: CommentRow[]; commentsDown?: boolean; mailBodies?: string[] };
async function fakeServices(page: Page, board: Board = { rows: [], posts: [], deletes: [], mails: 0 }) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("https://ssqcfsbkmrhjfylxghfj.supabase.co/**", async (r: Route) => {
    if (board.down) return r.fulfill({ status: 500, body: "down" });
    const url = r.request().url(), method = r.request().method();
    if (url.includes("/rest/v1/comments") || url.includes("delete_comment")) {
      board.comments ??= [];
      if (board.commentsDown) return r.fulfill({ status: 500, body: "down" });
      if (method === "GET") { const id = new URL(url).searchParams.get("idea_id")!.slice(3); return r.fulfill({ json: board.comments.filter((x) => x.idea_id === id) }); }
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
  await page.route("https://formspree.io/**", (r) => { board.mails++; (board.mailBodies ??= []).push(r.request().postData() ?? ""); return r.fulfill({ json: { ok: true } }); });
  return board;
}
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  return errors;
}

test.describe("pages by URL", () => {
  for (const [path, title, visible] of [
    ["/", "Ideas to life · Revaz Kuparadze", "#view-home"],
    ["/about/", "About · Revaz Kuparadze", "#view-about"],
    ["/craft/", "Craft · Revaz Kuparadze", "#view-craft"],
    ["/econsul/", "eConsul · Revaz Kuparadze", "#sheet"],
    ["/momo/", "Momo · Revaz Kuparadze", "#sheet"],
  ] as const) {
    test(`${path} opens with its own content and no errors`, async ({ page }) => {
      await fakeServices(page);
      const errors = watchErrors(page);
      await page.goto(path);
      await expect(page).toHaveTitle(title);
      await expect(page.locator(visible)).toBeVisible();
      await page.waitForTimeout(500);
      expect(errors).toEqual([]);
    });
  }
  test("unknown URLs get the 404 page, which still works as the site", async ({ page }) => {
    await fakeServices(page);
    const res = await page.goto("/nope/");
    expect(res?.status()).toBe(404);
    await expect(page.locator("#view-home")).toBeVisible();
  });
  test("pages read without JavaScript", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/econsul/");
    await expect(page.locator("#sheet-title")).toHaveText("eConsul");
    await expect(page.locator("#sheet-facts")).toContainText("NPS 79");
    await page.goto("/craft/");
    await expect(page.locator("#view-craft h1")).toHaveText("Craft");
    await ctx.close();
  });
});

test("navigation stays in the page and the back button works", async ({ page }) => {
  await fakeServices(page);
  await page.goto("/");
  await page.locator('.nav a[data-route="about"]').click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.locator("#view-about")).toBeVisible();
  await expect(page.locator("#view-home")).toBeHidden();
  await expect(page.locator('.nav a[data-route="about"]')).toHaveAttribute("aria-current", "");
  await page.goBack();
  await expect(page).toHaveURL(/127\.0\.0\.1:4329\/$/);
  await expect(page.locator("#view-home")).toBeVisible();
});

test("old #links go to the real page", async ({ page }) => {
  await fakeServices(page);
  await page.goto("/#craft");
  await expect(page).toHaveURL(/\/craft\/$/);
  await expect(page.locator("#view-craft")).toBeVisible();
});

test("an idea plane opens its page, and Back returns to the sky", async ({ page }) => {
  await fakeServices(page);
  await page.goto("/");
  const plane = page.locator('.plane[data-slug="ephoto"]');
  await expect(plane).toHaveAttribute("aria-label", "02 · ePhoto.AI: open the idea");
  await plane.focus(); // focus pauses it
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ephoto\/$/);
  await expect(page.locator("#sheet-title")).toHaveText("ePhoto.AI");
  await expect(page).toHaveTitle("ePhoto.AI · Revaz Kuparadze");
  await page.locator("#back").click();
  await expect(page).toHaveURL(/127\.0\.0\.1:4329\/$/);
  await expect(page.locator("#sheet")).toBeHidden();
});

test("planes can be dragged and thrown", async ({ page }) => {
  await fakeServices(page);
  await page.goto("/");
  await page.waitForTimeout(400);
  const plane = page.locator('.plane[data-slug="momo"]');
  await plane.focus(); // pause it so we can grab it reliably
  const box = (await plane.boundingBox())!;
  const x0 = box.x + box.width / 2, y0 = box.y + box.height / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 - i * 25, y0, { steps: 1 });
  await page.mouse.up();
  await expect(page).toHaveURL(/127\.0\.0\.1:4329\/$/); // a drag is not a click
  const after = (await plane.boundingBox())!;
  expect(after.x).toBeLessThan(box.x - 150);
});

test("post an idea: it flies to the sky, opens as a letter, and its author can remove it", async ({ page }) => {
  const board = await fakeServices(page);
  await page.goto("/");
  await page.locator("#note-name").fill("Nino");
  await page.locator("#note-email").fill("nino@");
  await page.locator("#note-msg").fill("A bike-share for Tbilisi hills");
  await page.locator(".note-send").click();
  await expect(page.locator("#note-done")).toBeVisible();
  const note = page.locator(".plane.note-p");
  await expect(note).toHaveCount(1, { timeout: 8000 });
  await expect(note).toHaveAttribute("aria-label", "Idea1: open the note");
  expect(board.posts).toHaveLength(1);
  expect(board.posts[0]).toMatchObject({ name: "Nino", message: "A bike-share for Tbilisi hills" });
  expect(JSON.stringify(board.posts[0])).not.toContain("nino@"); // email never goes to the public board
  expect(board.mails).toBe(1);
  await note.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#letter")).toBeVisible();
  await expect(page.locator("#letter-body")).toHaveText("A bike-share for Tbilisi hills");
  await expect(page.locator("#letter-date")).toContainText("From Nino");
  await page.locator("#letter-remove").click();
  await expect(page.locator("#letter")).toBeHidden();
  await expect(note).toHaveCount(0);
  expect(board.deletes).toHaveLength(1);
});

test("other people's ideas can be read but not removed", async ({ page }) => {
  await fakeServices(page, { rows: [{ id: "zzzzzz1", name: "Gio", message: "Night markets", created_at: "2026-09-30T10:00:00Z" }], posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  const note = page.locator(".plane.note-p");
  await expect(note).toHaveCount(1);
  await note.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#letter-body")).toHaveText("Night markets");
  await expect(page.locator("#letter-remove")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("#letter")).toBeHidden();
});

test("if the board is down, the idea still flies and the visitor is told", async ({ page }) => {
  await fakeServices(page, { rows: [], down: true, posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  await page.locator("#note-msg").fill("Still here");
  await page.locator(".note-send").click();
  await expect(page.locator("#note-done-text")).toContainText("couldn’t save it just now");
  await expect(page.locator(".plane.note-p")).toHaveCount(1, { timeout: 8000 });
});

test("the hero button opens the note; it needs an idea; Escape closes it", async ({ page }) => {
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
  await expect(page.locator("#note-wrap #note-form")).toHaveCount(1); // the form went back home
});

test("bots that fill the hidden field are ignored", async ({ page }) => {
  const board = await fakeServices(page);
  await page.goto("/");
  await page.locator("#note-msg").fill("spam");
  await page.locator('#note-form input[name="_gotcha"]').evaluate((el: HTMLInputElement) => { el.value = "bot"; });
  await page.locator(".note-send").click();
  await page.waitForTimeout(500);
  expect(board.posts).toHaveLength(0);
  expect(board.mails).toBe(0);
});

test("About: a stop opens its story, again closes it, and its links lead on", async ({ page }) => {
  await fakeServices(page);
  await page.goto("/about/");
  const abk = page.locator('.node-btn[data-stop="abk"]');
  await abk.click();
  await expect(abk).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#stop-inner h3")).toContainText("ABK agency");
  await abk.click();
  await expect(abk).toHaveAttribute("aria-expanded", "false");
  await abk.click();
  await page.locator('#stop-inner .panel-link[data-target="craft"]').click();
  await expect(page).toHaveURL(/\/craft\/$/);
  await page.goto("/about/");
  await page.locator('.b-link[data-target="greencard"]').click();
  await expect(page.locator("#sheet-title")).toHaveText("greencard.ge");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("shows the plain list instead of the sky, and it still opens ideas and notes", async ({ page }) => {
    await fakeServices(page, { rows: [{ id: "zzzzzz1", name: "Gio", message: "Night markets", created_at: "2026-09-30T10:00:00Z" }], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    await expect(page.locator("#fallback")).toBeVisible();
    await expect(page.locator(".plane")).toHaveCount(0);
    await page.locator('#ideas a[data-slug="econsul"]').click();
    await expect(page).toHaveURL(/\/econsul\/$/);
    await page.locator("#back").click();
    await page.locator("#notes-list a").first().click();
    await expect(page.locator("#letter-body")).toHaveText("Night markets");
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const path of ["/", "/about/", "/craft/", "/econsul/"]) {
    test(`${path} fits the screen with no sideways scroll`, async ({ page }) => {
      await fakeServices(page);
      await page.goto(path);
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw).toBeLessThanOrEqual(cw);
    });
  }
});

test("SEO basics: canonical, structured data, sitemap", async ({ page, request }) => {
  await page.goto("/econsul/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://revazkuparadze.com/econsul/");
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld["@graph"].map((x: { "@type": string }) => x["@type"])).toEqual(["Person", "WebPage", "CreativeWork"]);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const p of ["", "about/", "craft/", "econsul/", "ephoto/", "greencard/", "momo/"]) expect(sitemap).toContain(`<loc>https://revazkuparadze.com/${p}</loc>`);
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://revazkuparadze.com/sitemap.xml");
  // GitHub Pages hides folders starting with _ (like _astro/) unless .nojekyll is present
  expect((await request.get("/.nojekyll")).status()).toBe(200);
});

test.describe("comments on visitor ideas", () => {
  const gio = (): Board => ({ rows: [{ id: "zzzzzz1", name: "Gio", message: "Night markets", created_at: "2026-09-30T10:00:00Z" }], posts: [], deletes: [], mails: 0,
    comments: [{ id: "cmt0001", idea_id: "zzzzzz1", name: "Ana", message: "Yes please", created_at: "2026-09-30T11:00:00Z" }] });
  async function openGio(page: Page) {
    const note = page.locator(".plane.note-p");
    await expect(note).toHaveCount(1);
    await note.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
  }

  test("anyone reads the thread, adds a comment (emailed to Rez), and can remove only their own", async ({ page }) => {
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
    await mine.locator(".c-remove").click();
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
    await page.locator("#note-msg").fill("Fresh idea");
    await page.locator(".note-send").click();
    const note = page.locator(".plane.note-p");
    await expect(note).toHaveCount(1, { timeout: 8000 });
    await note.focus();
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
