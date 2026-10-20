import { test, expect } from "@playwright/test";
import { dreamRow, fakeServices, gioRow, settled, watchErrors } from "./fixtures";

test.describe("categories (set by Jev)", () => {
  test("an open idea shows its category tags", async ({ page }) => {
    await fakeServices(page, { rows: [{ ...gioRow, categories: ["food-drink", "city-places"] }], posts: [], deletes: [] });
    await page.goto("/");
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1);
    await plane.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-cats li")).toHaveText(["Food & Drink", "City & Places"]);
    await settled(page);
    const who = (await page.locator("#letter-date").boundingBox())!, tags = (await page.locator("#letter-cats").boundingBox())!;
    expect(Math.abs((who.y + who.height / 2) - (tags.y + tags.height / 2))).toBeLessThan(8); // on the author and date's line…
    expect(tags.x).toBeGreaterThan(who.x + who.width); // …on the right
  });

  test("a bird takes its main category's tint, as a fish takes its school's; one not sorted yet stays plain", async ({ page }) => {
    const board = await fakeServices(page, { rows: [{ ...gioRow, categories: ["tech", "science"] }, { ...gioRow, id: "plain1", categories: [] }], posts: [], deletes: [] });
    board.categorizeDown = true; // so plain1 stays unsorted
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveCount(2);
    const tech = page.locator(`.plane[data-slug="${gioRow.id}"]`), plain = page.locator('.plane[data-slug="plain1"]');
    await expect(tech).toHaveAttribute("data-flock", "tech");
    await expect(plain).toHaveAttribute("data-flock", "");
    const tailOf = (bird: typeof tech) => bird.locator(".pf.ot1").first().evaluate((el) => getComputedStyle(el).fill);
    expect(await tailOf(tech)).toBe("rgb(140, 108, 240)");
    expect(await tailOf(plain)).not.toBe("rgb(140, 108, 240)");
  });

  test("ideas and dreams left without categories are sorted when shown, once, and join their flock and school", async ({ page }) => {
    const board = await fakeServices(page, { rows: [{ ...gioRow, categories: [] }, { ...gioRow, id: "sorted1", categories: ["health"] }, dreamRow("dream0001", "I was flying", null)], posts: [], deletes: [] });
    board.categorize = ["play-games"];
    await page.goto("/");
    await expect(page.locator(`.plane[data-slug="${gioRow.id}"]`)).toHaveAttribute("data-flock", "play-games");
    await expect(page.locator('.fish[data-slug="dream0001"]')).toHaveAttribute("data-school", "play-games");
    expect([...(board.categorizeCalls ?? [])].sort()).toEqual(["dream0001", gioRow.id].sort()); // the sorted one is left alone
    await page.locator(`.plane[data-slug="${gioRow.id}"]`).focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-cats li")).toHaveText(["Play & Games"]);
  });

  test("an idea that can't be sorted yet shows no tags", async ({ page }) => {
    const board = await fakeServices(page, { rows: [{ ...gioRow, categories: [] }], posts: [], deletes: [] });
    board.categorizeDown = true;
    await page.goto("/");
    await page.locator(".plane").focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
    await expect(page.locator("#letter-cats")).toBeHidden();
  });

  test("a new idea is sorted once it's saved, and its letter shows the tags", async ({ page }) => {
    const board = await fakeServices(page);
    board.categorize = ["tech", "science"];
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-msg").fill("A telescope app that names the stars you point at");
    await page.locator(".note-send").click();
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1, { timeout: 8000 });
    await expect.poll(() => board.categorizeCalls?.length ?? 0).toBe(1);
    expect(board.categorizeCalls![0]).toBe((board.posts[0] as { id: string }).id);
    await expect(plane).toHaveAttribute("data-flock", "tech"); // once sorted, it joins the Tech flock
    await plane.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-cats li")).toHaveText(["Tech", "Science"]);
  });

  test("if sorting fails, the idea is still posted and nothing breaks", async ({ page }) => {
    const board = await fakeServices(page);
    board.categorizeDown = true;
    const errors = watchErrors(page);
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-msg").fill("Night markets in every borough");
    await page.locator(".note-send").click();
    await expect(page.locator(".plane")).toHaveCount(1, { timeout: 8000 });
    await expect.poll(() => board.categorizeCalls?.length ?? 0).toBe(1);
    await page.locator(".plane").focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#letter-body")).toHaveText("Night markets in every borough");
    await expect(page.locator("#letter-cats")).toBeHidden();
    expect(errors.filter((e) => !e.includes("502"))).toEqual([]); // the failed request itself is logged by the browser; nothing else
  });
});
