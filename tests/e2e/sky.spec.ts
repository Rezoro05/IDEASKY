import { test, expect, type Page, type Locator } from "@playwright/test";
import { fakeServices, withGio } from "./fixtures";

test("planes can be dragged and thrown, and a drag does not open the idea", async ({ page }) => {
  await fakeServices(page, withGio());
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveCount(1);
  await expect(plane, "the sky should have placed the plane (its first frame)").toHaveAttribute("style", /translate3d/);
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
  test.setTimeout(90_000); // it watches real flight until it has seen enough; a loaded machine just takes longer (the default 30 s cut it off)
  const rows = ["aaaaaa1", "bbbbbb2", "cccccc3", "dddddd4", "eeeeee5", "ffffff6"].map((id, i) => ({ id, name: "A", message: "Idea " + i, created_at: `2026-09-30T1${i}:00:00Z` }));
  await fakeServices(page, { rows, posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  await expect(page.locator(".plane")).toHaveCount(6);
  const sample = () => page.$$eval(".plane", (els) => els.map((el) => {
    const r = el.getBoundingClientRect(); // the anchor moves only with flight; the drawing's box also shifts when it turns
    return { id: el.getAttribute("data-slug")!, x: r.left, y: r.top, mirrored: (el.querySelector(".body")!.getAttribute("style") ?? "").includes("scaleX(-1)") };
  }));
  const seen = { left: 0, right: 0 };
  const lastDx = new Map<string, number>(); // a plane is judged only once it has held its direction for two samples: mid-turn it may lag behind
  let before = await sample();
  for (let i = 0; i < 400 && (seen.left < 3 || seen.right < 3); i++) {
    await page.waitForTimeout(150);
    const now = await sample();
    for (const p of now) {
      const q = before.find((b) => b.id === p.id);
      if (!q) continue;
      const dx = p.x - q.x, dy = p.y - q.y;
      if (Math.abs(dx) < 3 || Math.abs(dx) < 2 * Math.abs(dy)) { lastDx.delete(p.id); continue; } // only clearly sideways motion
      const steady = Math.sign(lastDx.get(p.id) ?? 0) === Math.sign(dx);
      lastDx.set(p.id, dx);
      if (!steady) continue;
      expect(p.mirrored, `plane moving ${dx < 0 ? "left" : "right"}`).toBe(dx < 0);
      seen[dx < 0 ? "left" : "right"]++;
    }
    before = now;
  }
  expect(seen.left, "samples of planes steadily heading left").toBeGreaterThanOrEqual(3);
  expect(seen.right, "samples of planes steadily heading right").toBeGreaterThanOrEqual(3);
});

test("a live idea flies as a bird with a wing look; an idea in the first stage stays a paper plane", async ({ page }) => {
  const rows = [
    { id: "aaaaaa1", name: "A", message: "A live idea", stage: "live", created_at: "2026-09-30T10:00:00Z" },
    { id: "bbbbbb2", name: "B", message: "A fresh idea", stage: "idea", created_at: "2026-09-30T11:00:00Z" },
  ];
  await fakeServices(page, { rows, posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  await expect(page.locator(".plane")).toHaveCount(2);
  const bird = page.locator('.plane[data-stage="live"]');
  const paper = page.locator('.plane[data-stage="idea"]');
  await expect(bird).toHaveCount(1);
  await expect(bird).toHaveAttribute("data-state", /^(glide|flap|held|perch)$/);
  await expect(paper).toHaveCount(1);
  expect(await paper.getAttribute("data-state")).toBeNull();
});

/** True once anything has been painted on the sky's trail canvas. */
const trailPainted = (page: Page) => page.locator(".sky-trails").evaluate((c: HTMLCanvasElement) => {
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) return true;
  return false;
});
const oneIdea = (stage: "idea" | "implementation") => ({ rows: [{ id: "cccccc3", name: "C", message: "An idea", stage, created_at: "2026-09-30T12:00:00Z" }], posts: [], deletes: [], mails: 0 });

test("an In Progress airplane leaves a faint trail behind it", async ({ page }) => {
  await fakeServices(page, oneIdea("implementation"));
  await page.goto("/");
  await expect(page.locator('.plane[data-stage="implementation"]')).toHaveCount(1);
  await expect.poll(() => trailPainted(page), { timeout: 8000, message: "an airplane should have painted a trail" }).toBe(true);
});

test("a paper plane leaves no trail", async ({ page }) => {
  await fakeServices(page, oneIdea("idea"));
  await page.goto("/");
  await expect(page.locator('.plane[data-stage="idea"]')).toHaveCount(1);
  await page.waitForTimeout(3000);
  expect(await trailPainted(page)).toBe(false);
});

const liveRow = { id: "aaaaaa1", name: "A", message: "A live idea", stage: "live", created_at: "2026-09-30T10:00:00Z" };
/** Records every value the near wing takes from now on (the sky sets it every frame: 1 up, -1 down). */
const recordWing = (plane: Locator) => plane.evaluate((el) => {
  const g = el.querySelector<SVGGElement>(".bw-near")!, seen: number[] = ((window as any).__wing = []);
  new MutationObserver(() => { const m = /matrix\(1 0 0 (-?[\d.]+) 0 0\)/.exec(g.getAttribute("transform") ?? ""); if (m) seen.push(Number(m[1])); }).observe(g, { attributes: true, attributeFilter: ["transform"] });
});
const wingSeen = (page: Page) => page.evaluate(() => (window as any).__wing as number[]);
/** How many times the wing changed direction (each beat turns twice). */
const turns = (w: number[]) => w.filter((x, i) => i > 1 && Math.sign(w[i - 1]! - w[i - 2]!) !== Math.sign(x - w[i - 1]!) && x !== w[i - 1]).length;

test("the bird is drawn with shapes, and the sky moves its wings smoothly (no pictures to swap)", async ({ page }) => {
  await fakeServices(page, { rows: [liveRow], posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveAttribute("style", /translate3d/);
  await expect(plane.locator("img")).toHaveCount(0);
  await expect(plane.locator(".bw-near")).toHaveCount(1);
  await expect(plane.locator(".bw-far")).toHaveCount(1);
  await recordWing(plane);
  await page.waitForTimeout(2500);
  const w = await wingSeen(page);
  expect(new Set(w.map((x) => x.toFixed(2))).size, "the wing should take many positions, not a few").toBeGreaterThan(5);
  expect(w.some((x) => Math.abs(x) > 0.2 && Math.abs(x) < 0.9), "in-between positions show it moves continuously").toBe(true);
  for (const x of w) { expect(x).toBeLessThanOrEqual(1); expect(x).toBeGreaterThanOrEqual(-1); }
});

test("a bird in the hand beats its wings fast and struggles", async ({ page }) => {
  await fakeServices(page, { rows: [liveRow], posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveAttribute("style", /translate3d/); // the sky has placed it
  await plane.focus(); // paused, so it holds still to be grabbed
  const box = (await plane.locator(".body").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(plane).toHaveAttribute("data-state", "held");
  await page.waitForTimeout(400); // past the blend into the held beat
  await recordWing(plane);
  await page.waitForTimeout(1000);
  const w = await wingSeen(page);
  expect(Math.max(...w) - Math.min(...w), "full strokes").toBeGreaterThan(1);
  expect(turns(w), "many beats in a second").toBeGreaterThanOrEqual(4);
  const running = await plane.locator(".body").evaluate((el) => el.getAnimations().filter((a) => a.playState === "running").map((a) => (a as CSSAnimation).animationName));
  expect(running).toContain("tug");
  await page.mouse.up();
});

test("a perched bird shows its legs; a flying one tucks them away", async ({ page }) => {
  await fakeServices(page, { rows: [liveRow], posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveAttribute("style", /translate3d/);
  // the sky sets the state every frame, so hold each one while it is looked at
  await plane.evaluate((el) => { (window as any).__look = "glide"; new MutationObserver(() => { if (el.dataset.state !== (window as any).__look) el.dataset.state = (window as any).__look; }).observe(el, { attributes: true, attributeFilter: ["data-state"] }); });
  const look = (name: string) => page.evaluate((n) => { (window as any).__look = n; document.querySelector<HTMLElement>(".plane")!.dataset.state = n; }, name);
  const legs = () => plane.locator(".bird-legs").evaluate((el) => Number(getComputedStyle(el).opacity));
  await look("glide");
  await expect.poll(legs, { timeout: 8000 }).toBe(0);
  await look("perch");
  await expect.poll(legs, { timeout: 8000 }).toBe(1);
});
