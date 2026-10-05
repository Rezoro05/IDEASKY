import { test, expect } from "@playwright/test";
import { fakeServices, watchErrors, withGio } from "./fixtures";

test("the home page opens with IDEA SKY content and no errors", async ({ page }) => {
  await fakeServices(page);
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle("IDEA SKY · Share ideas, bring them to life");
  await expect(page.locator("h1")).toHaveText("IDEA SKY");
  await expect(page.locator(".closing")).toHaveCount(0); // one section: the sky
  await expect(page.locator(".bar .wordmark")).toHaveCount(0); // the name is the headline now, not repeated top left
  await expect(page.locator(".thesis p").first()).toHaveText(/^Idea without execution is just a thought exercise\./);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test("unknown URLs get the 404 page, which still works as the site", async ({ page }) => {
  await fakeServices(page);
  const res = await page.goto("/nope/");
  expect(res?.status()).toBe(404);
  await expect(page.locator("#field")).toBeVisible();
  await expect(page.locator("h1")).toHaveText("IDEA SKY");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("shows the plain list instead of the sky, and it still opens ideas", async ({ page }) => {
    await fakeServices(page, withGio());
    await page.goto("/");
    await expect(page.locator("#fallback")).toBeVisible();
    await expect(page.locator(".plane")).toHaveCount(0);
    await page.locator("#ideas-list a").first().click();
    await expect(page.locator("#letter-body")).toHaveText("Night markets");
    await page.keyboard.press("Escape");
    await expect(page.locator("#letter")).toBeHidden(); // no fold or flight without motion
    await expect(page.locator(".note-flier")).toHaveCount(0);
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("the page fits the screen with no sideways scroll", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw).toBeLessThanOrEqual(cw);
  });
});

test("SEO basics: canonical, structured data, sitemap", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://rezoro05.github.io/IDEASKY/");
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld).toMatchObject({ "@type": "WebSite", name: "IDEA SKY" });
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://rezoro05.github.io/IDEASKY/</loc>");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://rezoro05.github.io/IDEASKY/sitemap.xml");
  // GitHub Pages hides folders starting with _ (like _astro/) unless .nojekyll is present
  expect((await request.get("/.nojekyll")).status()).toBe(200);
});
