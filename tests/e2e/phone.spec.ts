import { test, expect, type Page } from "@playwright/test";
import { dreamRow, fakeServices, gioRow } from "./fixtures";

/** On a phone: a real finger (touch events through the browser, so touch-action and pointer cancelling apply as on a phone),
 *  pressing a little beside a moving bird or fish, as a thumb does, and carrying it down into the cage or the net. */
test.describe("on a phone, with a thumb", () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  const finger = async (page: Page) => {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", p?: { x: number; y: number }) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    return { down: (p: { x: number; y: number }) => touch("touchStart", p), move: (p: { x: number; y: number }) => touch("touchMove", p), up: () => touch("touchEnd") };
  };
  const middleOf = async (page: Page, sel: string) => { const r = (await page.locator(sel).first().boundingBox())!; return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  /** Press just beside what `sel` shows (not on it), then carry it to `target` and let go beside that too. */
  const carry = async (page: Page, sel: string, target: string) => {
    const f = await finger(page);
    for (let i = 0; i < 6; i++) {
      await page.waitForFunction((s) => (document.querySelector(s)?.closest(".plane, .fish") as HTMLElement | null)?.style.transform, sel);
      const at = await middleOf(page, sel), from = { x: at.x, y: at.y + (at.y < 390 ? 30 : -30) }; // just beside it (toward open water), outside its drawing
      await f.down(from);
      if (!(await page.locator(".held").count())) { await f.up(); await page.waitForTimeout(500); continue; }
      const to = await middleOf(page, target), end = { x: to.x - 42, y: to.y }; // a thumb drops near, not on it (beyond a mouse's edge)
      for (let k = 1; k <= 14; k++) { await f.move({ x: from.x + (end.x - from.x) * k / 14, y: from.y + (end.y - from.y) * k / 14 }); await page.waitForTimeout(16); }
      await f.up();
      if (await page.locator("#letter").isVisible().catch(() => false)) return true;
      await page.waitForTimeout(1200);
      if (await page.locator("#letter").isVisible()) return true;
    }
    return false;
  };

  test("a thumb pressing beside a bird catches it, and dropping near the cage opens its idea", async ({ page }) => {
    await fakeServices(page, { rows: [{ ...gioRow }], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    expect(await carry(page, ".plane .body", "#cage")).toBe(true);
    await expect(page.locator("#letter-from")).toHaveText("Idea1");
  });

  test("a thumb pressing beside a fish catches it, and dropping near the net opens its dream", async ({ page }) => {
    await fakeServices(page, { rows: [dreamRow("dreamph1", "A lighthouse that sang", ["water"], 1)], posts: [], deletes: [], mails: 0 });
    await page.goto("/#sea");
    expect(await carry(page, ".fish .body", "#fish-net")).toBe(true);
    await expect(page.locator("#letter-from")).toHaveText("Dream1");
  });

  test("an open idea fits the visible screen, even a short one, with its icons in view", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 560 });
    const long = "A pocket-sized weather station that clips to a balcony rail and shares readings with the block. ".repeat(6);
    await fakeServices(page, { rows: [{ ...gioRow, message: long }], posts: [], deletes: [], mails: 0 });
    await page.goto("/#idea-" + gioRow.id);
    await expect(page.locator("#letter")).toBeVisible();
    await page.waitForTimeout(900);
    const card = (await page.locator(".letter-card").boundingBox())!;
    expect(card.y).toBeGreaterThanOrEqual(0); expect(card.y + card.height).toBeLessThanOrEqual(560);
    expect(await page.locator(".letter-card").evaluate((el) => getComputedStyle(el).maxHeight)).toBe("528px"); // the visible height less its margin
  });
});
