import { test, expect, type Locator, type Page } from "@playwright/test";
import { fakeServices } from "./fixtures";

const idea = (stage: "implementation" | "live" | "idea") => ({ rows: [{ id: "bbbbbb2", name: "Bea", message: "A caught idea", stage, created_at: "2026-09-30T12:00:00Z" }], posts: [], deletes: [], mails: 0 });

/** A paused plane (keyboard focus holds it still) and the middle of it, so a press lands on it reliably. */
async function pausedPlane(page: Page, stage: "implementation" | "live" | "idea") {
  await fakeServices(page, idea(stage));
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveCount(1);
  await expect(plane, "the sky should have placed the plane (its first frame)").toHaveAttribute("style", /translate3d/);
  await page.waitForTimeout(400);
  let at = { x: 0, y: 0 };
  for (let tries = 0; tries < 12; tries++) { // a plane paused under the header bar can't be pressed: let it fly on and try again
    await plane.focus();
    const b = (await plane.locator(".body").boundingBox())!;
    at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    if (await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".plane"), at)) break;
    await plane.evaluate((el) => (el as HTMLElement).blur());
    await page.waitForTimeout(700);
  }
  return { plane, at };
}
/** Focus only paused the plane so it could be grabbed; once it is in the hand it should fly like any other when let go. */
const unpause = (plane: Locator) => () => plane.evaluate((el) => (el as HTMLElement).blur());
/** Records every wing look the bird shows from now on (a take-off lasts about a second, and polling can step right over it). */
const recordLooks = (plane: Locator) => plane.evaluate((el) => {
  const seen: string[] = ((window as any).__looks = []);
  new MutationObserver(() => { const s = el.dataset.state; if (s && seen[seen.length - 1] !== s) seen.push(s); }).observe(el, { attributes: true, attributeFilter: ["data-state"] });
});
const looksSeen = (page: Page) => page.evaluate(() => ((window as any).__looks as string[]).join(">"));
const centerOf = async (page: Page, selector: string) => { const b = (await page.locator(selector).boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
/** Press on the plane, carry it to a point in a handful of moves, and (optionally) let go. `onHold` runs once the plane is in the hand. */
async function carry(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release = true, onHold?: () => Promise<unknown>) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await onHold?.();
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
  if (release) await page.mouse.up();
}

test("a bird dropped in the cage opens its idea", async ({ page }) => {
  const { at } = await pausedPlane(page, "idea");
  await carry(page, at, await centerOf(page, "#cage"));
  await expect(page.locator("#letter-body")).toHaveText("A caught idea");
});

test("a bird let go anywhere else opens nothing and flies off flapping", async ({ page }) => {
  const { plane, at } = await pausedPlane(page, "idea");
  await recordLooks(plane);
  await carry(page, at, { x: at.x > 500 ? at.x - 160 : at.x + 160, y: at.y + 40 }, true, unpause(plane));
  await expect(page.locator("#letter")).toBeHidden();
  await expect.poll(() => looksSeen(page), { timeout: 8000, message: "it should take off (flap), then fly free (glide)" }).toMatch(/flap>glide/);
});

test("a tap on a bird catches it and lets it go; it does not open the idea", async ({ page }) => {
  const { plane, at } = await pausedPlane(page, "idea");
  await recordLooks(plane);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await unpause(plane)();
  await page.waitForTimeout(100); // a real tap lasts a few frames
  await page.mouse.up();
  await expect.poll(() => looksSeen(page), { timeout: 8000, message: "it should flap in the hand or on taking off, then glide again" }).toMatch(/flap>glide/);
  await expect(page.locator("#letter")).toBeHidden();
});

test("the cage lights up while a bird is held, and more when it is over the cage", async ({ page }) => {
  const { at } = await pausedPlane(page, "idea");
  const cage = await centerOf(page, "#cage");
  const away = { x: Math.max(60, cage.x - 500), y: cage.y + 300 }; // far from the cage, wherever the bird was
  await expect(page.locator("#field")).not.toHaveClass(/holding-bird/);
  await carry(page, at, away, false);
  await expect(page.locator("#field")).toHaveClass(/holding-bird/);
  await expect(page.locator("#cage")).not.toHaveClass(/over/);
  await page.mouse.move(cage.x, cage.y, { steps: 8 });
  await expect(page.locator("#cage")).toHaveClass(/over/);
  await page.mouse.move(away.x, away.y, { steps: 8 });
  await expect(page.locator("#cage")).not.toHaveClass(/over/);
  await page.mouse.up();
  await expect(page.locator("#field")).not.toHaveClass(/holding-bird/);
});

test("the cage says what it is for when you point at it", async ({ page }) => {
  await pausedPlane(page, "idea");
  const hint = page.locator(".cage-hint");
  await expect(hint).toHaveText("Catch an idea and put it in the cage to see it.");
  await expect(hint).toHaveCSS("opacity", "0");
  await page.locator("#cage").hover();
  await expect(hint).toHaveCSS("opacity", "1");
});

test("a bird opened from the cage waits there and flies off when the letter closes", async ({ page }) => {
  const { plane, at } = await pausedPlane(page, "idea");
  const cage = await centerOf(page, "#cage");
  await carry(page, at, cage, true, unpause(plane));
  await expect(page.locator("#letter-body")).toHaveText("A caught idea");
  await page.keyboard.press("Escape");
  await expect(page.locator("#letter")).toBeHidden();
  await expect(plane).toHaveAttribute("data-state", /flap|glide/);
  await expect.poll(async () => { const b = (await plane.locator(".body").boundingBox())!; return Math.hypot(b.x + b.width / 2 - cage.x, b.y + b.height / 2 - cage.y); }, { timeout: 8000, message: "the bird should leave the cage" }).toBeGreaterThan(80);
});

test("a paper plane is not caged: a tap opens it, and dropping it on the cage only throws it", async ({ page }) => {
  const { plane, at } = await pausedPlane(page, "implementation");
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator("#letter-body")).toHaveText("A caught idea");
  await page.keyboard.press("Escape");
  await expect(page.locator("#letter")).toBeHidden();
  const b = (await plane.locator(".body").boundingBox())!;
  await carry(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, await centerOf(page, "#cage"));
  await page.waitForTimeout(300);
  await expect(page.locator("#letter")).toBeHidden();
});

test("a bird still opens from the keyboard", async ({ page }) => {
  const { plane } = await pausedPlane(page, "idea");
  await plane.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#letter-body")).toHaveText("A caught idea");
});
