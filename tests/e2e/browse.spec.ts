import { test, expect } from "@playwright/test";
import { dreamRow, fakeServices, settled, type Board, type Row } from "./fixtures";

/** `n` ideas an hour apart, newest first; every third is Tech, the rest Health. */
const ideas = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({
  id: `idea${String(i).padStart(3, "0")}`, name: "Anonymous", message: `Idea number ${n - i}`,
  created_at: new Date(Date.UTC(2026, 9, 1) - i * 3_600_000).toISOString(), categories: [i % 3 === 0 ? "tech" : "health"],
}));
const board = (rows: Row[]): Board => ({ rows, posts: [], deletes: [] });

test.describe("browse all ideas and dreams", () => {
  test("lists every idea, not just the few flying, newest first; a category narrows it; choosing one opens it", async ({ page }) => {
    await fakeServices(page, board(ideas(10)));
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveCount(8); // the sky shows the newest eight
    await page.locator("#browse-ideas").click(); await settled(page);
    await expect(page.locator("#browse-title")).toHaveText("All ideas");
    const items = page.locator(".browse-item");
    await expect(items).toHaveCount(10);
    await expect(items.first().locator(".b-line")).toHaveText("Idea number 10");
    await expect(items.first().locator(".b-name")).toHaveText("Idea10");
    await expect(items.last().locator(".b-name")).toHaveText("Idea1");
    await expect(page.locator("#browse-chips button")).toHaveText(["All", "Tech", "Health"]);
    await page.locator("#browse-chips button", { hasText: "Tech" }).click();
    await expect(items).toHaveCount(4);
    await expect(page.locator("#browse-chips button", { hasText: "Tech" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#browse-more")).toBeHidden(); // all ten are loaded already
    await page.locator(".browse-item", { hasText: "Idea number 1" }).last().click(); // the oldest: not in the sky
    await expect(page.locator("#browse")).toBeHidden();
    await expect(page.locator("#letter-body")).toHaveText("Idea number 1");
    await expect(page.locator("#letter-from")).toHaveText("Idea1");
  });

  test("older ones load on request, and the newest keep their numbers", async ({ page }) => {
    await fakeServices(page, board(ideas(65)));
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveCount(8);
    await expect(page.locator(".plane .tag").filter({ hasText: "Idea65" })).toHaveCount(1); // numbered from the oldest of all 65
    await page.locator("#browse-ideas").click(); await settled(page);
    await expect(page.locator(".browse-item")).toHaveCount(60);
    await page.locator("#browse-more").click();
    await expect(page.locator(".browse-item")).toHaveCount(65);
    await expect(page.locator(".browse-item").last().locator(".b-name")).toHaveText("Idea1");
    await expect(page.locator("#browse-more")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.locator("#browse")).toBeHidden();
    await expect(page.locator(".plane .tag").filter({ hasText: "Idea65" })).toHaveCount(1); // the sky is as it was
  });

  test("the sea has its own: all dreams, by theme", async ({ page }) => {
    await fakeServices(page, board([dreamRow("dream001", "I could breathe underwater", ["water"]), dreamRow("dream002", "Flying over the school", ["flying"], 2)]));
    await page.goto("/#sea");
    await page.locator("#browse-dreams").click(); await settled(page);
    await expect(page.locator("#browse-title")).toHaveText("All dreams");
    await expect(page.locator(".browse-item .b-line")).toHaveText(["I could breathe underwater", "Flying over the school"]);
    await page.locator("#browse-chips button", { hasText: "Flying" }).click();
    await expect(page.locator(".browse-item")).toHaveCount(1);
  });
});

test.describe("a liked idea or dream grows a little", () => {
  test("liked birds fly bigger, and grow when you like one", async ({ page }) => {
    const b = board(ideas(3));
    b.likes = [1, 2, 3, 4, 5].map((n) => ({ idea_id: "idea000", liker_hash: String(n).repeat(64) })); // five likes on the newest
    await fakeServices(page, b);
    await page.goto("/");
    const size = (id: string) => page.locator(`.plane[data-slug="${id}"]`).evaluate((el) => parseFloat((el as HTMLElement).style.getPropertyValue("--s")));
    await expect.poll(() => size("idea000")).toBeGreaterThan(0);
    const plain = await size("idea002");
    await expect.poll(() => size("idea000")).toBeCloseTo(plain * 1.3, 1); // 6% a like
    expect(b.likeCountsCalls).toBe(1); // all of the sky's likes in one request
    const bird = page.locator('.plane[data-slug="idea002"]');
    await bird.focus(); await page.keyboard.press("Enter");
    await page.locator("#like-btn").click();
    await expect(page.locator("#like-count")).toHaveText("1");
    await expect.poll(() => size("idea002")).toBeCloseTo(plain * 1.06, 1);
  });
});
