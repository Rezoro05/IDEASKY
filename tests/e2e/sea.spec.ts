import { test, expect, type Page } from "@playwright/test";
import { dreamRow, fakeServices, gioRow } from "./fixtures";

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

  test("a quick tap opens a dream: themes as tags, no stages, no updates", async ({ page }) => {
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

  test("press and hold nets a fish: it stays put, and a tap opens it", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    const { x, y } = await centre(page, "dreambb2");
    await page.mouse.move(x, y); await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    const fish = page.locator('.fish[data-slug="dreambb2"]');
    await expect(fish).toHaveClass(/\bnetted\b/);
    await expect(page.locator("#letter")).toBeHidden(); // a hold nets, it doesn't open
    const at = await fish.evaluate((el) => (el as HTMLElement).style.transform);
    await page.waitForTimeout(700);
    expect(await fish.evaluate((el) => (el as HTMLElement).style.transform)).toBe(at);
    const c = await centre(page, "dreambb2");
    await page.mouse.click(c.x, c.y);
    await expect(page.locator("#letter-from")).toHaveText("Dream2");
    await expect(fish).not.toHaveClass(/\bnetted\b/); // read and let go: it swims off when the letter closes
  });

  test("a tap on the water lets a netted fish go", async ({ page }) => {
    await fakeServices(page, sea());
    await page.goto("/#sea");
    const { x, y } = await centre(page, "dreambb1");
    await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
    await expect(page.locator('.fish[data-slug="dreambb1"]')).toHaveClass(/\bnetted\b/);
    const water = (await page.locator("#sea").boundingBox())!;
    await page.mouse.click(water.x + water.width - 30, water.y + water.height - 30);
    await expect(page.locator('.fish[data-slug="dreambb1"]')).not.toHaveClass(/\bnetted\b/);
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
