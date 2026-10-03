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
    await expect(page.locator("#updates")).toBeHidden(); // nothing to show until the first update
    await expect(page.locator(".letter-bar .owner-acts #add-update")).toBeVisible(); // the + at the right end of the icon line
    await page.locator("#add-update").click();
    await expect(page.locator("#updates")).toBeVisible();
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

  test("the comment, + and bin icons open one thing at a time and look the same when selected", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await postAndOpen(page);
    const icon = (id: string) => page.locator(`#${id}`);
    const selected = async (id: string) => icon(id).evaluate((el) => ({ open: el.getAttribute("aria-expanded"), color: getComputedStyle(el).color, chip: getComputedStyle(el).backgroundColor }));
    await icon("comment-btn").click();
    await expect(page.locator("#thread-form")).toBeVisible();
    const look = await selected("comment-btn");
    expect(look.open).toBe("true");
    expect(look.chip).not.toBe("rgba(0, 0, 0, 0)");
    await icon("add-update").click(); // + closes the comment form
    await expect(page.locator("#update-form")).toBeVisible();
    await expect(page.locator("#thread-form")).toBeHidden();
    expect(await selected("comment-btn")).toMatchObject({ open: "false", chip: "rgba(0, 0, 0, 0)" });
    await expect.poll(() => selected("add-update"), { message: "the + should look as the selected comment icon did" }).toEqual(look);
    await icon("letter-remove").click(); // the bin closes the update form
    await expect(page.locator("#remove-confirm")).toBeVisible();
    await expect(page.locator("#update-form")).toBeHidden();
    await expect.poll(() => selected("letter-remove"), { message: "the bin should look as the selected comment icon did" }).toEqual(look);
    await icon("comment-btn").click(); // and the comment icon closes the question
    await expect(page.locator("#thread-form")).toBeVisible();
    await expect(page.locator("#remove-confirm")).toBeHidden();
    await icon("comment-btn").click(); // the same icon again closes its own panel
    await expect(page.locator("#thread-form")).toBeHidden();
    expect(await selected("comment-btn")).toMatchObject({ open: "false" });
    await icon("add-update").click(); await icon("add-update").click();
    await expect(page.locator("#update-form")).toBeHidden();
    await expect(icon("add-update")).toBeVisible();
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
