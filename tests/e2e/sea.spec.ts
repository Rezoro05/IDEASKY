import { test, expect, type Page } from "@playwright/test";
import { dreamRow, fakeServices, gioRow, settled } from "./fixtures";
import { HANDLE_END, HOOP_UNITS, NET } from "../../src/lib/net";

/** The pointer holds the net's handle: to put the hoop on a point, hold the handle this far down and to the right of it. */
const grip = (p: { x: number; y: number }) => ({ x: p.x + HANDLE_END.x * NET.radius / HOOP_UNITS, y: p.y + HANDLE_END.y * NET.radius / HOOP_UNITS });

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

  test("Back to the sky sits in the sea where Dive sits in the sky: bottom centre", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    const vp = page.viewportSize()!;
    const dive = (await page.locator("#dive-btn").boundingBox())!;
    await page.locator("#dive-btn").click();
    await expect.poll(() => depth(page)).toBe("sea");
    await page.waitForTimeout(1000);
    const back = (await page.locator("#surface-btn").boundingBox())!;
    expect(Math.abs(back.x + back.width / 2 - vp.width / 2)).toBeLessThan(2);
    expect(Math.abs((back.y + back.height) - (dive.y + dive.height))).toBeLessThan(2);
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
    /** The fish's fastest pace (px/s) over the next `ms`, measured over 0.25 s windows (shorter ones jitter by a frame). A calm fish never tops 78 px/s; a frightened one reaches 144. */
    const topSpeed = (ms: number) => page.evaluate((ms) => new Promise<number>((done) => {
      const el = document.querySelector(".fish") as HTMLElement, read = () => el.style.transform.match(/-?[\d.]+/g)!.slice(1, 3).map(Number);
      let last = read(), lastT = performance.now(), top = 0; const end = lastT + ms;
      const tick = (t: number) => {
        const p = read(), dt = (t - lastT) / 1000;
        if (dt >= 0.25) { top = Math.max(top, Math.hypot(p[0]! - last[0]!, p[1]! - last[1]!) / dt); last = p; lastT = t; }
        if (t < end) requestAnimationFrame(tick); else done(top);
      };
      requestAnimationFrame(tick);
    }), ms);
    expect(await topSpeed(600)).toBeLessThan(90); // calm
    const side = before.x > (page.viewportSize()!.width / 2) ? 1 : -1; // come from the wall side, so it has open water to flee into
    await page.mouse.move(before.x + side * 160, before.y);
    const sampling = topSpeed(900);
    await page.mouse.move(before.x + side * 25, before.y, { steps: 6 }); // a quick sweep straight at it
    expect(await sampling).toBeGreaterThan(110); // it darted
    const after = await at();
    expect(Math.hypot(after.x - (before.x + side * 25), after.y - before.y)).toBeGreaterThan(60); // it got away from the mouse (which way is unit-tested in swim.test.ts)
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
  /** Fish keep swimming while a busy test machine works, so a catch may miss: re-aim and try again, as a person would (up to 4 tries). */
  const until = async (page: Page, attempt: () => Promise<void>, done: () => Promise<boolean>) => {
    for (let i = 0; i < 4; i++) { await attempt(); if (await done()) return; await page.waitForTimeout(900); }
  };
  const opened = (page: Page) => async () => (await page.locator("#letter").isVisible()) || (await page.waitForTimeout(1200), page.locator("#letter").isVisible());
  const centre = async (page: Page, slug: string) => {
    await page.waitForFunction((s) => (document.querySelector(`.fish[data-slug="${s}"]`) as HTMLElement | null)?.style.transform, slug);
    const r = (await page.locator(`.fish[data-slug="${slug}"] .body`).boundingBox())!;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };

  test("a caught dream opens with its themes as tags, no stages, no updates", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    await until(page, async () => { const { x, y } = grip(await centre(page, "dreambb1")); await page.mouse.click(x, y); }, opened(page));
    await expect(page.locator("#letter")).toBeVisible();
    await expect(page.locator("#letter-from")).toHaveText("Dream1");
    await expect(page.locator("#letter-body")).toHaveText("A whale showed me the way home");
    await expect(page.locator("#letter-cats li")).toHaveText(["Water", "Animals"]);
    await expect(page.locator("#stage-track")).toBeHidden();
    await expect(page.locator("#updates")).toBeHidden();
    await expect(page.locator("#add-update")).toBeHidden();
    await expect(page.locator("#like-btn")).toBeVisible(); // likes and comments work as for ideas
  });

  test("pressing with the hoop over a fish dips the net onto it; on release the fish wriggles in the net, then its dream opens", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    let netWhilePressed = 0;
    await until(page, async () => {
      const { x, y } = grip(await centre(page, "dreambb2"));
      await page.mouse.move(x, y); await page.mouse.down();
      netWhilePressed = await page.locator(".hand-net:not(.miss):not(.hit)").count(); // in the water while pressed
      await page.mouse.up();
    }, async () => (await page.locator('.fish[data-slug="dreambb2"].caught').count()) > 0);
    expect(netWhilePressed).toBe(1);
    await expect(page.locator(".hand-net.hit")).toHaveCount(1);
    await expect(page.locator("#letter-from")).toHaveText("Dream2");
    await expect(page.locator('.fish[data-slug="dreambb2"]')).not.toHaveClass(/\bcaught\b/);
    await expect(page.locator(".hand-net")).toHaveCount(0, { timeout: 2000 });
  });

  /** The spot in the lower water farthest from every fish. */
  const emptyWater = async (page: Page) => {
    await centre(page, "dreambb1");
    const fishAt = await page.locator(".fish .body").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
    const water = (await page.locator("#sea").boundingBox())!;
    let spot = { x: 0, y: 0 }, far = -1;
    for (let gx = 0.1; gx < 0.95; gx += 0.1) for (let gy = 0.55; gy < 0.95; gy += 0.1) {
      const p = { x: water.x + water.width * gx, y: water.y + water.height * gy };
      const d = Math.min(...fishAt.map(([fx, fy]) => Math.hypot(fx! - p.x, fy! - p.y)));
      if (d > far) { far = d; spot = p; }
    }
    return spot;
  };

  test("the pointer holds the handle; held, the net follows it and only its bag stretches; released on empty water it lifts away", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    const spot = await emptyWater(page), hand = grip(spot);
    await page.mouse.move(hand.x, hand.y); await page.mouse.down();
    const net = page.locator(".hand-net");
    const hoopAt = async () => { const r = (await net.boundingBox())!; return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; };
    const first = await hoopAt();
    expect(Math.abs(first.x - spot.x)).toBeLessThan(2); expect(Math.abs(first.y - spot.y)).toBeLessThan(2); // the hoop is ahead of the hand
    const bag = () => net.evaluate((el) => Number((el as HTMLElement).style.getPropertyValue("--bag")));
    expect(await bag()).toBeLessThan(1.1);
    await page.waitForTimeout(1300);
    expect(await bag()).toBeGreaterThan(1.4); // the bag has stretched…
    expect((await hoopAt()).w).toBe(first.w); // …and the net kept its size
    await page.mouse.move(hand.x - 30, hand.y - 20);
    await expect.poll(async () => (await hoopAt()).x).toBeLessThan(spot.x - 20); // it follows the hand
    await page.mouse.up();
    await expect(page.locator(".hand-net.miss")).toHaveCount(1);
    await expect(page.locator(".hand-net")).toHaveCount(0, { timeout: 2000 });
    await expect(page.locator("#letter")).toBeHidden();
  });

  test("inside the hoop there is only water; the mesh is on the bag outside the rim", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    const spot = await emptyWater(page), hand = grip(spot);
    await page.mouse.move(hand.x, hand.y); await page.mouse.down();
    await expect(page.locator(".hand-net .hn-mouth-mesh")).toHaveCount(0);
    await expect(page.locator(".hand-net [mask] .hn-bag-mesh")).toHaveCount(1); // the bag's mesh is masked off inside the rim
    await page.mouse.up();
  });

  test("a net held in the water and brought onto a fish catches it on release", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    await until(page, async () => {
      const spot = grip(await emptyWater(page));
      await page.mouse.move(spot.x, spot.y); await page.mouse.down();
      await page.waitForTimeout(400);
      const fish = grip(await centre(page, "dreambb1"));
      await page.mouse.move(fish.x, fish.y); // bring the hoop over it…
      await page.mouse.up(); // …and lift
    }, opened(page));
    await expect(page.locator("#letter-from")).toHaveText("Dream1");
  });

  test("the normal pointer shows over the water", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    expect(await page.locator("#sea").evaluate((el) => getComputedStyle(el).cursor)).toBe("auto");
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

