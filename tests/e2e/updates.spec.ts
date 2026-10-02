import { test, expect, type Page } from "@playwright/test";
import { fakeServices, settled, withGio } from "./fixtures";

test.describe("owner updates", () => {
  async function postAndOpen(page: Page) {
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-msg").fill("A shared tool library");
    await page.locator(".note-send").click();
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1, { timeout: 8000 });
    await plane.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
    await settled(page);
  }

  test("the owner adds dated updates with links, oldest first; they stay after a reload and can be removed", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postAndOpen(page);
    await expect(page.locator("#updates-count")).toHaveText("No updates yet");
    await page.locator("#add-update").click();
    await expect(page.locator("#update-msg")).toBeFocused();
    await page.locator("#update-msg").fill("Found three neighbors with spare drills");
    await page.locator("#update-link-rows .add-link").click();
    await page.locator("#update-link-rows .link-url").fill("toolshare.example.org/pilot");
    await page.locator(".update-send").click();
    await expect(page.locator(".updates-list > li")).toHaveCount(1);
    await expect(page.locator("#letter")).toBeVisible(); // the letter stays open after an update
    expect(board.updates![0]).toMatchObject({ message: "Found three neighbors with spare drills", links: [{ title: "toolshare.example.org", url: "https://toolshare.example.org/pilot" }] });
    await page.locator("#add-update").click();
    await page.locator("#update-msg").fill("First 12 tools lent out");
    await page.locator(".update-send").click();
    await expect(page.locator(".updates-list > li .c-body")).toHaveText(["Found three neighbors with spare drills", "First 12 tools lent out"]);
    await page.reload();
    await expect(page.locator(".plane")).toHaveCount(1);
    await page.locator(".plane").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#updates-count")).toHaveText("2 updates");
    await page.locator(".updates-list > li").first().locator(".c-remove").click();
    await expect(page.locator(".updates-list > li")).toHaveCount(1);
    expect(board.updates).toHaveLength(1);
  });

  test("an update needs text, and if it can't be saved the text stays", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postAndOpen(page);
    await page.locator("#add-update").click();
    await page.locator(".update-send").click();
    await expect(page.locator("#update-error")).toHaveText("Write your update first.");
    board.updatesDown = true;
    await page.locator("#update-msg").fill("Keep me");
    await page.locator(".update-send").click();
    await expect(page.locator("#update-error")).toContainText("Couldn’t post your update");
    await expect(page.locator("#update-msg")).toHaveValue("Keep me");
  });

  test("everyone else reads the updates but cannot add or remove them; with none, the section stays out of the way", async ({ page }) => {
    await fakeServices(page, { ...withGio(), updates: [{ id: "upd0001", idea_id: "zzzzzz1", message: "Permit approved", links: [], created_at: "2026-10-01T10:00:00Z" }] });
    await page.goto("/");
    await page.locator(".plane").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".updates-list > li .c-body")).toHaveText(["Permit approved"]);
    await expect(page.locator("#add-update")).toBeHidden();
    await expect(page.locator(".updates-list .c-remove")).toHaveCount(0);
  });

  test("other people's ideas without updates show no updates section", async ({ page }) => {
    await fakeServices(page, withGio());
    await page.goto("/");
    await page.locator(".plane").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter-body")).toHaveText("Night markets");
    await page.waitForTimeout(300);
    await expect(page.locator("#updates")).toBeHidden();
  });
});
