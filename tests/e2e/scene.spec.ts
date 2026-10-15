import { test, expect, type Page } from "@playwright/test";
import { fakeServices } from "./fixtures";

/** The test build has the 3D backgrounds off (PUBLIC_SCENE=0), so other tests don't pay for them; these turn them on as the studio does. */
const STORE = "skyofideas.studio";
// WebGL through the software renderer, so the backgrounds can be drawn headless. Only here: it changes how other pages composite.
test.use({ launchOptions: { executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } });
const turnOn = (page: Page, settings: unknown = { sky: { on: true }, sea: { on: true } }) =>
  page.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); } catch { /* none */ } }, [STORE, JSON.stringify(settings)] as const);
const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), STORE);
const shown = (page: Page, scene: "sky" | "sea") => page.locator(`.scene-${scene}.shown`);

test.describe("the 3D backgrounds", () => {
  test("off in this build: the skyline picture stays, no canvas is shown", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await page.waitForTimeout(1500);
    await expect(page.locator(".scene-canvas.shown")).toHaveCount(0);
    await expect(page.locator(".skyline")).toBeVisible();
    await expect(page.locator(".studio")).toHaveCount(0); // visitors never see the studio
  });

  test("on: the skyline is drawn in 3D and the picture fades under it; the sea is drawn after a dive", async ({ page }) => {
    await fakeServices(page);
    await turnOn(page);
    await page.goto("/");
    await expect(shown(page, "sky")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator("#field")).toHaveClass(/scene-sky-on/); // the picture fades out under it (site.css)
    await page.locator("#dive-btn").click();
    await expect(shown(page, "sea")).toHaveCount(1, { timeout: 15_000 });
  });

  test("the studio at #studio: changes show at once, are kept, and copy as only what changed", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await fakeServices(page);
    await page.goto("/#studio");
    const studio = page.locator(".studio");
    await expect(studio).toBeVisible();
    await expect(studio.getByRole("tab", { name: "Sky" })).toHaveAttribute("aria-selected", "true");
    await studio.getByLabel("3D background").check();
    await studio.getByRole("group", { name: "Camera" }).getByRole("button", { name: "drift" }).click();
    await expect(studio.getByText("Floats slowly by itself")).toBeVisible();
    expect((await saved(page)).sky.camera.mode).toBe("drift");
    await expect(shown(page, "sky")).toHaveCount(1, { timeout: 15_000 });

    await studio.getByRole("button", { name: "Copy settings" }).click();
    const copied = JSON.parse(await studio.getByLabel("Settings to send").inputValue());
    expect(copied).toEqual({ sky: { on: true, camera: { mode: "drift" } } });

    await page.reload(); // kept in this browser
    await expect(page.locator(".studio").getByRole("group", { name: "Camera" }).getByRole("button", { name: "drift" })).toHaveAttribute("aria-pressed", "true");
  });

  test("keys and the wheel inside the studio don't dive; the Deep sea tab dives to show what it tunes", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/#studio");
    const studio = page.locator(".studio");
    const range = studio.getByLabel("Range");
    await range.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("PageDown");
    await studio.locator(".studio-body").hover();
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.dataset.depth)).toBe("sky");
    await studio.getByRole("tab", { name: "Deep sea" }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.depth)).toBe("sea");
    await studio.getByLabel("Whale").uncheck();
    expect((await saved(page)).sea.elements.whale.on).toBe(false);
  });

  test("Picture only and Reset: the picture comes back, then the site's own settings", async ({ page }) => {
    await fakeServices(page);
    await turnOn(page);
    await page.goto("/#studio");
    await expect(shown(page, "sky")).toHaveCount(1, { timeout: 15_000 });
    const studio = page.locator(".studio");
    await studio.getByRole("button", { name: "Picture only" }).click();
    await expect(page.locator(".scene-sky")).toBeHidden();
    await expect(page.locator("#field")).not.toHaveClass(/scene-sky-on/); // the picture fades back in (site.css)
    await studio.getByRole("button", { name: "Reset" }).click();
    expect(await saved(page)).toBeNull();
    await studio.getByRole("button", { name: "Close the studio" }).click();
    await expect(studio).toHaveCount(0);
    await expect(page).not.toHaveURL(/#studio/);
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("no 3D at all, even when turned on", async ({ page }) => {
      await fakeServices(page);
      await turnOn(page);
      await page.goto("/");
      await page.waitForTimeout(1500);
      await expect(page.locator(".scene-canvas")).toHaveCount(0);
    });
  });
});
