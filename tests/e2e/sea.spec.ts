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

  test("on the web, the cage sits in the bottom right corner of the sky, Dive at the bottom centre", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    const vp = page.viewportSize()!;
    const cage = (await page.locator("#cage").boundingBox())!, dive = (await page.locator("#dive-btn").boundingBox())!;
    expect(cage.x + cage.width).toBeGreaterThan(vp.width - 60); expect(cage.y + cage.height).toBeGreaterThan(vp.height - 60);
    expect(Math.abs(dive.x + dive.width / 2 - vp.width / 2)).toBeLessThan(2);
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
    test("the cage sits at the bottom centre, on top of Dive", async ({ page }) => {
      await fakeServices(page);
      await page.goto("/");
      const cage = (await page.locator("#cage").boundingBox())!, dive = (await page.locator("#dive-btn").boundingBox())!;
      expect(Math.abs(cage.x + cage.width / 2 - 195)).toBeLessThan(2); expect(Math.abs(dive.x + dive.width / 2 - 195)).toBeLessThan(2);
      expect(cage.y + cage.height).toBeLessThan(dive.y); expect(dive.y - (cage.y + cage.height)).toBeLessThan(24); // just above it
      expect(780 - (dive.y + dive.height)).toBeLessThan(50); // Dive near the bottom
    });
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
  /** Fish keep swimming while a busy test machine works, so a press may miss: re-aim and try again, as a person would (up to 6 tries). */
  const until = async (page: Page, attempt: () => Promise<void>, done: () => Promise<boolean>) => {
    for (let i = 0; i < 6; i++) { await attempt(); if (await done()) return; await page.waitForTimeout(900); }
  };
  const opened = (page: Page) => async () => (await page.locator("#letter").isVisible()) || (await page.waitForTimeout(1500), page.locator("#letter").isVisible());
  const centre = async (page: Page, slug: string) => {
    await page.waitForFunction((s) => (document.querySelector(`.fish[data-slug="${s}"]`) as HTMLElement | null)?.style.transform, slug);
    const r = (await page.locator(`.fish[data-slug="${slug}"] .body`).boundingBox())!;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const middleOf = async (page: Page, sel: string) => { const r = (await page.locator(sel).boundingBox())!; return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  /** Press a fish (it is held only if the press lands on it). */
  const grab = async (page: Page, slug: string) => {
    const c = await centre(page, slug);
    await page.mouse.move(c.x, c.y); await page.mouse.down();
    return (await page.locator(`.fish[data-slug="${slug}"].held`).count()) > 0;
  };
  /** Hold a fish and carry it into the net, then let go there. */
  const carryToNet = (page: Page, slug: string) => until(page, async () => {
    if (!(await grab(page, slug))) { await page.mouse.up(); return; }
    const net = await middleOf(page, "#fish-net");
    await page.mouse.move(net.x, net.y, { steps: 10 });
    await page.mouse.up();
  }, opened(page));

  test("a fish dropped in the net opens its dream, with its themes as tags, no stages, no updates", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    await carryToNet(page, "dreambb1");
    await expect(page.locator("#letter")).toBeVisible();
    await expect(page.locator("#letter-from")).toHaveText("Dream1");
    await expect(page.locator("#letter-body")).toHaveText("A whale showed me the way home");
    await expect(page.locator("#letter-cats li")).toHaveText(["Water", "Animals"]);
    await expect(page.locator("#stage-track")).toBeHidden();
    await expect(page.locator("#updates")).toBeHidden();
    await expect(page.locator("#add-update")).toBeHidden();
    await expect(page.locator("#like-btn")).toBeVisible(); // likes and comments work as for ideas
  });

  test("a press holds a fish: it follows the hand and the net lights up, over the net it is ready; let go elsewhere, it bolts and nothing opens", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    let held = false;
    await until(page, async () => { held = await grab(page, "dreambb2"); if (!held) await page.mouse.up(); }, async () => held);
    expect(held).toBe(true);
    await expect(page.locator("#sea")).toHaveClass(/\bholding-fish\b/);
    const water = (await page.locator("#sea").boundingBox())!, spot = { x: water.x + water.width * 0.35, y: water.y + water.height * 0.5 };
    await page.mouse.move(spot.x, spot.y, { steps: 8 });
    await expect.poll(async () => { const c = await centre(page, "dreambb2"); return Math.hypot(c.x - spot.x, c.y - spot.y); }).toBeLessThan(12); // in the hand
    const net = await middleOf(page, "#fish-net");
    await page.mouse.move(net.x, net.y, { steps: 8 });
    await expect(page.locator("#fish-net")).toHaveClass(/\bover\b/);
    await page.mouse.move(spot.x, spot.y, { steps: 8 });
    await expect(page.locator("#fish-net")).not.toHaveClass(/\bover\b/);
    await page.mouse.up();
    await expect(page.locator("#sea")).not.toHaveClass(/\bholding-fish\b/);
    await expect(page.locator('.fish[data-slug="dreambb2"]')).not.toHaveClass(/\bheld\b/);
    await expect.poll(async () => { const c = await centre(page, "dreambb2"); return Math.hypot(c.x - spot.x, c.y - spot.y); }).toBeGreaterThan(60); // it bolted
    await expect(page.locator("#letter")).toBeHidden();
  });

  test("a fish in the net waits there while its dream is open, and darts out when it closes", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    await carryToNet(page, "dreambb2");
    await expect(page.locator("#letter-from")).toHaveText("Dream2");
    const fishEl = page.locator('.fish[data-slug="dreambb2"]');
    await expect(fishEl).toHaveClass(/\bin-net\b/);
    const net = await middleOf(page, "#fish-net"), inNet = await centre(page, "dreambb2");
    expect(Math.hypot(inNet.x - net.x, inNet.y - net.y)).toBeLessThan(30);
    await page.keyboard.press("Escape");
    await expect(page.locator("#letter")).toBeHidden();
    await expect(fishEl).not.toHaveClass(/\bin-net\b/, { timeout: 3000 });
    await expect.poll(async () => { const c = await centre(page, "dreambb2"); return Math.hypot(c.x - net.x, c.y - net.y); }).toBeGreaterThan(80);
  });

  test("pressing open water does nothing: no net is dipped and nothing opens", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    await centre(page, "dreambb1");
    const water = (await page.locator("#sea").boundingBox())!;
    await page.mouse.click(water.x + 8, water.y + water.height * 0.6);
    await expect(page.locator(".hand-net")).toHaveCount(0);
    await expect(page.locator("#sea")).not.toHaveClass(/\bholding-fish\b/);
    await page.waitForTimeout(600);
    await expect(page.locator("#letter")).toBeHidden();
  });

  test("the normal pointer shows over the water", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    expect(await page.locator("#sea").evaluate((el) => getComputedStyle(el).cursor)).toBe("auto");
  });

  test("keyboard: Enter on a focused fish opens its dream", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    await page.locator('.fish[data-slug="dreambb1"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter-from")).toHaveText("Dream1");
  });

  test("on the web: the net sits bottom right just above Feedback; Back to the sky is in the middle of the footer line", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    const vp = page.viewportSize()!;
    const net = (await page.locator("#fish-net").boundingBox())!, feedback = (await page.locator("#feedback-btn").boundingBox())!;
    const rez = (await page.locator(".foot > span").first().boundingBox())!, back = (await page.locator("#surface-btn").boundingBox())!;
    expect(net.x + net.width).toBeGreaterThan(vp.width - 60); // the right edge, at the gutter
    expect(net.y + net.height).toBeLessThan(feedback.y); // above Feedback…
    expect(feedback.y - (net.y + net.height)).toBeLessThan(30); // …just above
    expect(Math.abs(back.x + back.width / 2 - vp.width / 2)).toBeLessThan(2); // centred
    const mid = (r: { y: number; height: number }) => r.y + r.height / 2;
    expect(Math.abs(mid(back) - mid(feedback))).toBeLessThan(3); expect(Math.abs(mid(rez) - mid(feedback))).toBeLessThan(3); // one line
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
    /** A real finger: touch events through the browser, so touch-action and pointer cancelling apply as on a phone. */
    const finger = async (page: Page) => {
      const cdp = await page.context().newCDPSession(page);
      const touch = (type: "touchStart" | "touchMove" | "touchEnd", p?: { x: number; y: number }) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
      return { down: (p: { x: number; y: number }) => touch("touchStart", p), move: (p: { x: number; y: number }) => touch("touchMove", p), up: () => touch("touchEnd") };
    };

    test("a finger holds a fish and drags it, any way, into the net at the bottom centre; its dream opens", async ({ page }) => {
      await fakeServices(page, sea());
      await page.goto("/#sea");
      const f = await finger(page);
      await until(page, async () => {
        const c = await centre(page, "dreambb2");
        await f.down(c);
        if (!(await page.locator('.fish[data-slug="dreambb2"].held').count())) { await f.up(); return; }
        const up = { x: c.x, y: Math.max(120, c.y - 120) }; // first up (once taken for a scroll), then down into the net
        for (let i = 1; i <= 8; i++) { await f.move({ x: c.x, y: c.y + (up.y - c.y) * i / 8 }); await page.waitForTimeout(16); }
        await expect(page.locator('.fish[data-slug="dreambb2"]')).toHaveClass(/\bheld\b/); // still held: the page didn't take it
        const net = await middleOf(page, "#fish-net");
        for (let i = 1; i <= 12; i++) { await f.move({ x: up.x + (net.x - up.x) * i / 12, y: up.y + (net.y - up.y) * i / 12 }); await page.waitForTimeout(16); }
        await f.up();
      }, opened(page));
      await expect(page.locator("#letter-from")).toHaveText("Dream2");
    });

    test("the net sits at the bottom centre on top of Back to the sky; Ideas from REZ and Feedback sit together on the left", async ({ page }) => {
      await fakeServices(page, sea());
      await page.goto("/#sea");
      const net = (await page.locator("#fish-net").boundingBox())!, back = (await page.locator("#surface-btn").boundingBox())!;
      const rez = (await page.locator(".foot > span").first().boundingBox())!, feedback = (await page.locator("#feedback-btn").boundingBox())!;
      const cx = (r: { x: number; width: number }) => r.x + r.width / 2;
      expect(Math.abs(cx(net) - 195)).toBeLessThan(2); expect(Math.abs(cx(back) - 195)).toBeLessThan(2);
      expect(net.y + net.height).toBeLessThan(back.y); expect(back.y - (net.y + net.height)).toBeLessThan(24); // just above it
      expect(back.y + back.height).toBeLessThan(rez.y); // the links are below it…
      expect(rez.x).toBeLessThan(30); expect(feedback.x).toBeGreaterThan(rez.x + rez.width); expect(feedback.x).toBeLessThan(195); // …together, on the left
      expect(Math.abs(rez.y - feedback.y)).toBeLessThan(4);
    });
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

