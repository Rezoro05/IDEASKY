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
/** Every (look, photo) pair the bird shows from now on, and every photo it passes through (the sim sets both each frame). */
const recordPhotos = (plane: Locator) => plane.evaluate((el) => {
  const w = window as any; w.__pairs = new Set<string>(); w.__frames = [];
  const note = () => { const f = el.dataset.frame; if (el.dataset.state && f) { w.__pairs.add(`${el.dataset.state}:${f}`); if (w.__frames[w.__frames.length - 1] !== f) w.__frames.push(f); } };
  new MutationObserver(note).observe(el, { attributes: true, attributeFilter: ["data-state", "data-frame"] }); note();
});

test("all six photos of the bird load, and only the one the sky names is shown", async ({ page }) => {
  await fakeServices(page, { rows: [liveRow], posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  await expect(page.locator(".plane")).toHaveCount(1);
  await expect(page.locator(".plane")).toHaveAttribute("data-frame", /.+/);
  const frames = page.locator(".plane .bird-frame");
  await expect(frames).toHaveCount(6);
  await expect.poll(() => frames.evaluateAll((els) => els.filter((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0).length), { message: "every photo should have loaded" }).toBe(6);
  const shown = await frames.evaluateAll((els) => els.filter((e) => getComputedStyle(e).opacity === "1").map((e) => (e as HTMLElement).dataset.frame));
  expect(shown).toHaveLength(1);
  expect(shown[0]).toBe(await page.locator(".plane").getAttribute("data-frame"));
});

test("a bird in the hand beats its wings frantically and struggles", async ({ page }) => {
  await fakeServices(page, { rows: [liveRow], posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveCount(1);
  await expect(plane).toHaveAttribute("style", /translate3d/); // the sky has placed it
  await plane.focus(); // paused, so it holds still to be grabbed
  const box = (await plane.locator(".body").boundingBox())!;
  await recordPhotos(plane);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(plane).toHaveAttribute("data-state", "held");
  await page.waitForTimeout(700);
  const { pairs, frames } = await page.evaluate(() => ({ pairs: [...(window as any).__pairs] as string[], frames: (window as any).__frames as string[] }));
  for (const p of pairs.filter((x) => x.startsWith("held:"))) expect(p).toMatch(/^held:fly-(spread|up)$/);
  expect(new Set(frames).size, "the wings should change photo while held").toBeGreaterThanOrEqual(2);
  const running = await plane.locator(".body").evaluate((el) => el.getAnimations().filter((a) => a.playState === "running").map((a) => (a as CSSAnimation).animationName));
  expect(running).toContain("tug");
  await page.mouse.up();
});

test("the photo always matches what the bird is doing: bursts of flaps and folded coasting when cruising, steady flapping, a resting pose on a perch", async ({ page }) => {
  await fakeServices(page, { rows: [liveRow], posts: [], deletes: [], mails: 0 });
  await page.goto("/");
  const plane = page.locator(".plane");
  await expect(plane).toHaveAttribute("style", /translate3d/);
  await recordPhotos(plane);
  await page.waitForTimeout(2500);
  const pairs = await page.evaluate(() => [...(window as any).__pairs] as string[]);
  expect(pairs.some((x) => x.startsWith("glide:")), "it should be cruising").toBe(true);
  expect(new Set(pairs.filter((x) => x.startsWith("glide:"))).size, "cruising should show flaps as well as the folded coast").toBeGreaterThanOrEqual(3);
  for (const p of pairs) {
    if (p.startsWith("glide:")) expect(p).toMatch(/^glide:fly-/);
    if (p.startsWith("flap:")) expect(p).toMatch(/^flap:fly-/);
    if (p.startsWith("perch:")) expect(p).toMatch(/^perch:rest-/);
  }
});
