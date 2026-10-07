import { test, expect, type Page } from "@playwright/test";
import { dreamRow, fakeServices, gioRow, settled } from "./fixtures";

const depth = (page: Page) => page.evaluate(() => document.documentElement.dataset.depth);
const planeAt = (page: Page) => page.locator(".plane").first().evaluate((el) => (el as HTMLElement).style.transform);

test.describe("the Sea of Dreams: diving and surfacing", () => {
  test("Dive glides down to the sea; the sky holds still and can't be tabbed into; Back to the sky returns", async ({ page }) => {
    await fakeServices(page, { rows: [{ ...gioRow }], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveCount(1);
    await page.waitForFunction(() => (document.querySelector(".plane") as HTMLElement | null)?.style.transform);
    await page.locator("#dive-btn").click();
    await expect.poll(() => depth(page)).toBe("sea");
    await expect(page).toHaveURL(/#sea$/);
    await expect(page.locator("#sea-title")).toBeFocused();
    await expect(page.locator("#sea-title")).toHaveText("Sea of Dreams");
    expect(await page.locator("#sky-part").evaluate((el) => (el as HTMLElement).inert)).toBe(true);
    await page.waitForTimeout(1000); // the glide ends
    const before = await planeAt(page);
    await page.waitForTimeout(600);
    expect(await planeAt(page)).toBe(before); // out of view, the sky doesn't spend frames
    await expect(page.locator("#sea")).toBeInViewport();
    await page.locator("#surface-btn").click();
    await expect.poll(() => depth(page)).toBe("sky");
    await expect(page).not.toHaveURL(/#sea/);
    await expect(page.locator("#dive-btn")).toBeFocused();
    expect(await page.locator("#sea").evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  });

  test("scrolling down dives and scrolling up surfaces; Page Down and Page Up do the same", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => depth(page)).toBe("sea");
    await page.waitForTimeout(1300); // one flick moves once
    await page.mouse.wheel(0, -400);
    await expect.poll(() => depth(page)).toBe("sky");
    await page.waitForTimeout(1300);
    await page.keyboard.press("PageDown");
    await expect.poll(() => depth(page)).toBe("sea");
    await page.keyboard.press("PageUp");
    await expect.poll(() => depth(page)).toBe("sky");
  });

  test("an open note stops diving", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await page.locator("#idea-btn").click();
    await expect(page.locator("#compose")).toBeVisible();
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(400);
    expect(await depth(page)).toBe("sky");
  });

  test("a link to the sea (#sea) opens the visit in the sea", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/#sea");
    expect(await depth(page)).toBe("sea");
    await expect(page.locator("#sea")).toBeInViewport();
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("the sea is simply below; Dive scrolls to it", async ({ page }) => {
      await fakeServices(page);
      await page.goto("/");
      await page.locator("#dive-btn").click();
      await expect(page.locator("#sea-title")).toBeInViewport();
      await expect(page.locator("#sea-title")).toBeFocused();
      expect(await page.locator("#sea").evaluate((el) => (el as HTMLElement).inert)).toBe(false);
    });
  });
});

test.describe("fish (dreams)", () => {
  const dreams = () => ({
    rows: [
      { ...gioRow }, // an idea: it flies in the sky, never swims
      dreamRow("dreamaa1", "I could fly over the river", ["flying", "water"], 5),
      dreamRow("dreamaa2", "Floating above the clouds", ["flying"], 4),
      dreamRow("dreamaa3", "The subway filled with sea water", ["water"], 3),
      dreamRow("dreamaa4", "A dream not sorted yet", null, 2),
    ],
    posts: [], deletes: [], mails: 0,
  });

  test("dreams swim in the sea as fish, named Dream1…, in schools by their main theme; ideas stay in the sky", async ({ page }) => {
    await fakeServices(page, dreams());
    await page.goto("/#sea");
    const fish = page.locator(".fish");
    await expect(fish).toHaveCount(4);
    await expect(page.locator(".plane")).toHaveCount(1);
    await expect(page.locator('.fish[data-slug="dreamaa1"]')).toHaveAttribute("aria-label", "Dream1: open the dream");
    await expect(page.locator('.fish[data-slug="dreamaa1"]')).toHaveAttribute("data-school", "flying");
    await expect(page.locator('.fish[data-slug="dreamaa3"]')).toHaveAttribute("data-school", "water");
    await expect(page.locator('.fish[data-slug="dreamaa4"]')).toHaveAttribute("data-school", "");
    await expect(page.locator('.fish[data-slug="dreamaa4"] .tag')).toHaveText("Dream4");
  });

  test("fish swim while the sea is in view and hold still from the sky", async ({ page }) => {
    await fakeServices(page, dreams());
    await page.goto("/#sea");
    const where = () => page.locator(".fish").first().evaluate((el) => (el as HTMLElement).style.transform);
    await page.waitForFunction(() => (document.querySelector(".fish") as HTMLElement | null)?.style.transform);
    const a = await where();
    await expect.poll(where).not.toBe(a);
    await page.locator("#surface-btn").click();
    await page.waitForTimeout(1100);
    const b = await where();
    await page.waitForTimeout(600);
    expect(await where()).toBe(b);
  });

  test("a fish darts away from a quickly moving mouse, as a bird does", async ({ page }) => {
    await fakeServices(page, { rows: [dreamRow("dreamcc1", "A lone fish", null, 1)], posts: [], deletes: [], mails: 0 });
    await page.goto("/#sea");
    await page.waitForFunction(() => (document.querySelector(".fish") as HTMLElement | null)?.style.transform);
    await page.waitForTimeout(1000); // the glide down has ended
    const at = async () => { const r = (await page.locator(".fish .body").boundingBox())!; return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    const before = await at();
    /** The fish's fastest pace (px/s) over the next `ms`, measured over 0.1 s windows (single frames jitter). A calm fish never tops 78 px/s. */
    const topSpeed = (ms: number) => page.evaluate((ms) => new Promise<number>((done) => {
      const el = document.querySelector(".fish") as HTMLElement, read = () => el.style.transform.match(/-?[\d.]+/g)!.slice(1, 3).map(Number);
      let last = read(), lastT = performance.now(), top = 0; const end = lastT + ms;
      const tick = (t: number) => {
        const p = read(), dt = (t - lastT) / 1000;
        if (dt >= 0.1) { top = Math.max(top, Math.hypot(p[0]! - last[0]!, p[1]! - last[1]!) / dt); last = p; lastT = t; }
        if (t < end) requestAnimationFrame(tick); else done(top);
      };
      requestAnimationFrame(tick);
    }), ms);
    expect(await topSpeed(500)).toBeLessThan(80); // calm
    await page.mouse.move(before.x - 160, before.y);
    const sampling = topSpeed(700);
    await page.mouse.move(before.x - 25, before.y, { steps: 6 }); // a quick sweep straight at it
    expect(await sampling).toBeGreaterThan(95); // it darted
    const after = await at();
    expect(after.x).toBeGreaterThan(before.x); // away from the mouse, not toward it
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("no fish are drawn", async ({ page }) => {
      await fakeServices(page, dreams());
      await page.goto("/");
      await page.waitForTimeout(500);
      await expect(page.locator(".fish")).toHaveCount(0);
    });
  });
});

test.describe("catching and opening dreams", () => {
  const sea = () => ({
    rows: [dreamRow("dreambb1", "A whale showed me the way home", ["water", "animals"], 3), dreamRow("dreambb2", "Stairs that never ended", ["places"], 2)],
    posts: [], deletes: [], mails: 0,
  });
  const centre = async (page: Page, slug: string) => {
    await page.waitForFunction((s) => (document.querySelector(`.fish[data-slug="${s}"]`) as HTMLElement | null)?.style.transform, slug);
    const r = (await page.locator(`.fish[data-slug="${slug}"] .body`).boundingBox())!;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };

  test("a caught dream opens with its themes as tags, no stages, no updates", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    const { x, y } = await centre(page, "dreambb1");
    await page.mouse.click(x, y);
    await expect(page.locator("#letter")).toBeVisible();
    await expect(page.locator("#letter-from")).toHaveText("Dream1");
    await expect(page.locator("#letter-body")).toHaveText("A whale showed me the way home");
    await expect(page.locator("#letter-cats li")).toHaveText(["Water", "Animals"]);
    await expect(page.locator("#stage-track")).toBeHidden();
    await expect(page.locator("#updates")).toBeHidden();
    await expect(page.locator("#add-update")).toBeHidden();
    await expect(page.locator("#like-btn")).toBeVisible(); // likes and comments work as for ideas
  });

  test("a click on a fish swoops the net onto it: the fish wriggles in the net, then its dream opens", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    const { x, y } = await centre(page, "dreambb2");
    await page.mouse.click(x, y);
    await expect(page.locator(".hand-net.hit")).toHaveCount(1);
    await expect(page.locator('.fish[data-slug="dreambb2"]')).toHaveClass(/\bcaught\b/);
    await expect(page.locator("#letter-from")).toHaveText("Dream2");
    await expect(page.locator('.fish[data-slug="dreambb2"]')).not.toHaveClass(/\bcaught\b/);
  });

  test("a click on empty water swoops an empty net: nothing opens, and the net goes", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    await centre(page, "dreambb1");
    const fishAt = await page.locator(".fish .body").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
    const water = (await page.locator("#sea").boundingBox())!;
    // the spot in the lower water farthest from every fish
    let spot = { x: 0, y: 0 }, far = -1;
    for (let gx = 0.1; gx < 0.95; gx += 0.1) for (let gy = 0.55; gy < 0.95; gy += 0.1) {
      const p = { x: water.x + water.width * gx, y: water.y + water.height * gy };
      const d = Math.min(...fishAt.map(([fx, fy]) => Math.hypot(fx! - p.x, fy! - p.y)));
      if (d > far) { far = d; spot = p; }
    }
    await page.mouse.click(spot.x, spot.y);
    await expect(page.locator(".hand-net")).toHaveCount(1);
    await expect(page.locator(".hand-net.hit")).toHaveCount(0);
    await expect(page.locator(".hand-net")).toHaveCount(0, { timeout: 2000 });
    await expect(page.locator("#letter")).toBeHidden();
  });

  test("the corner net is gone", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    await expect(page.locator("#net")).toHaveCount(0);
  });

  test("keyboard: Enter on a focused fish opens its dream", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    await page.locator('.fish[data-slug="dreambb1"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter-from")).toHaveText("Dream1");
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("dreams are a plain list in the sea, and open from it", async ({ page }) => {
      await fakeServices(page, sea());
      await page.goto("/");
      await page.locator("#dive-btn").click();
      await expect(page.locator("#dreams-list a")).toHaveCount(2);
      await page.locator("#dreams-list a", { hasText: "Stairs" }).click();
      await expect(page.locator("#letter-from")).toHaveText("Dream2");
    });
  });
});

test.describe("the Dream Note", () => {
  test("Share a Dream opens the note with dream words; a dream is posted as a dream, swims in, and is sorted into themes", async ({ page }) => {
    const board = await fakeServices(page);
    board.categorize = ["water", "strange"];
    await page.goto("/#sea");
    await page.locator("#dream-btn").click(); await settled(page);
    await expect(page.locator("#note-form")).toHaveAttribute("aria-label", "Share your dream");
    await expect(page.locator("#note-msg-label")).toHaveText("The dream");
    await expect(page.locator("#note-msg")).toHaveAttribute("placeholder", "Tell a dream you had");
    await page.locator(".note-send").click();
    await expect(page.locator("#note-error")).toHaveText("Write your dream first.");
    await page.locator("#note-msg").fill("I rode a bicycle across the bottom of the sea");
    await page.locator(".note-send").click();
    await expect(page.locator("#compose")).toBeHidden();
    const fish = page.locator(".fish");
    await expect(fish).toHaveCount(1);
    await expect(page.locator(".fish.arriving")).toHaveCount(0, { timeout: 6000 }); // the fish from the note has landed
    expect(board.posts[0]).toMatchObject({ message: "I rode a bicycle across the bottom of the sea", kind: "dream" });
    await expect.poll(() => board.categorizeCalls?.length ?? 0).toBe(1);
    expect(board.mailBodies?.[0]).toContain("New dream in the Sea of Dreams");
    await expect(page.locator(".plane")).toHaveCount(0); // a dream never flies in the sky
    await expect(fish).toHaveAttribute("data-school", "water");
    await fish.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-cats li")).toHaveText(["Water", "Strange"]);
  });

  test("the same note says idea again when opened from the sky", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/#sea");
    await page.locator("#dream-btn").click(); await settled(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#dream-btn")).toBeFocused();
    await page.locator("#surface-btn").click();
    await page.waitForTimeout(1000);
    await page.locator("#idea-btn").click(); await settled(page);
    await expect(page.locator("#note-msg-label")).toHaveText("The idea");
    await expect(page.locator("#note-mic .mic-label")).toHaveText(/Speak your idea/);
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("a dream joins the list in the sea, and the visitor is told", async ({ page }) => {
      await fakeServices(page);
      await page.goto("/");
      await page.locator("#dive-btn").click();
      await page.locator("#dream-btn").click();
      await page.locator("#note-msg").fill("Every door opened onto a different city");
      await page.locator(".note-send").click();
      await expect(page.locator("#toast")).toContainText("Your dream is in the sea");
      await expect(page.locator("#dreams-list a")).toHaveCount(1);
    });
  });
});

