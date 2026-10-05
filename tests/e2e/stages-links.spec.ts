import { test, expect, type Page } from "@playwright/test";
import { fakeServices, settled, gioRow } from "./fixtures";

test.describe("stages and links", () => {
  async function postWithLinks(page: Page, links: [string, string][]) {
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-msg").fill("A shared tool library");
    for (const [url, title] of links) {
      await page.locator("#compose .add-link").click();
      const row = page.locator(".link-row").last();
      await row.locator(".link-url").fill(url);
      await row.locator(".link-title").fill(title);
    }
    await page.locator(".note-send").click();
  }
  async function openOnly(page: Page) {
    const plane = page.locator(".plane");
    await expect(plane).toHaveCount(1, { timeout: 8000 });
    await plane.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#letter")).toBeVisible();
    await settled(page);
  }

  test("an idea is posted with its links, which open safely in a new tab", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, [["toolshare.example.org/plan", "Pilot plan"], ["https://github.com/someone/tools", ""]]);
    await expect.poll(() => board.posts.length).toBe(1);
    expect(board.posts[0]).toMatchObject({ links: [{ title: "Pilot plan", url: "https://toolshare.example.org/plan" }, { title: "github.com", url: "https://github.com/someone/tools" }] });
    expect(board.posts[0]).not.toHaveProperty("stage"); // the database starts every idea at "idea"
    await openOnly(page);
    const links = page.locator("#letter-links a");
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute("href", "https://toolshare.example.org/plan");
    await expect(links.first()).toHaveAttribute("target", "_blank");
    await expect(links.first()).toHaveAttribute("rel", /noopener/);
    await expect(page.locator('#stage-track label:has(input:checked)')).toContainText("Idea");
  });

  test("a link that isn't a web address stops the send and points at its row", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, [["example.com", ""], ["javascript:alert(1)", "Click me"]]);
    await expect(page.locator("#note-error")).toContainText("isn’t a web address");
    await expect(page.locator(".link-row").nth(1).locator(".link-url")).toBeFocused();
    await page.waitForTimeout(300);
    expect(board.posts).toHaveLength(0);
  });

  test("the link message goes as soon as the link is changed, cleared or removed", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, [["javascript:alert(1)", ""]]);
    const error = page.locator("#note-error");
    await expect(error).toContainText("isn’t a web address");
    await page.locator(".link-row .link-url").fill(""); // wiped out: the old complaint no longer applies
    await expect(error).toBeHidden();
    await page.locator(".link-row .link-url").fill("not a link"); // and a new mistake is only reported when it is sent again
    await expect(error).toBeHidden();
    await page.locator(".note-send").click();
    await expect(error).toContainText("isn’t a web address");
  });

  test("a title left without its address gets its own message", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, [["", "Draft plan"]]);
    await expect(page.locator("#note-error")).toContainText("title but no web address");
    await expect(page.locator(".link-row .link-url")).toBeFocused();
    await page.locator(".link-row .link-title").fill(""); // clearing the title too leaves a blank row, which is ignored
    await expect(page.locator("#note-error")).toBeHidden();
  });

  test("a link message also goes when its row is removed", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, [["javascript:alert(1)", ""]]);
    await expect(page.locator("#note-error")).toContainText("isn’t a web address");
    await page.locator(".link-row .link-remove").click();
    await expect(page.locator("#note-error")).toBeHidden();
  });

  test("up to five links; a row can be removed", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    for (let i = 0; i < 5; i++) await page.locator("#compose .add-link").click();
    await expect(page.locator(".link-row")).toHaveCount(5);
    await expect(page.locator("#compose .add-link")).toBeHidden();
    await page.locator(".link-row .link-remove").first().click();
    await expect(page.locator(".link-row")).toHaveCount(4);
    await expect(page.locator("#compose .add-link")).toBeVisible();
  });

  test("the owner moves the idea one step at a time by picking a stage, with no question asked; its plane changes form", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    const radio = (stage: string) => page.locator(`#stage-track input[value="${stage}"]`);
    const pick = (stage: string) => page.locator(`#stage-track label[data-stage="${stage}"]`).click();
    await expect(radio("idea")).toBeChecked();
    await expect(radio("live")).toBeDisabled(); // no jumping two stages
    await pick("implementation");
    await expect(page.locator("#stage-track label:has(input:checked)")).toContainText("In Progress");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "implementation");
    expect(board.stageMoves!.at(-1)).toMatchObject({ p_stage: "implementation", p_key: expect.stringMatching(/^[0-9a-f]{32}$/) });
    await expect(radio("live")).toBeEnabled();
    await pick("live");
    await expect(page.locator("#stage-track label:has(input:checked)")).toContainText("Live");
    await expect(radio("idea")).toBeDisabled();
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "live");
    await pick("implementation"); // and back, just as directly
    await expect(page.locator("#stage-track label:has(input:checked)")).toContainText("In Progress");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "implementation");
    expect(board.stageMoves).toHaveLength(3);
  });

  test("moved to Live, the plane becomes a bird at once, wings and all, without a reload", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    const pick = (stage: string) => page.locator(`#stage-track label[data-stage="${stage}"]`).click();
    await pick("implementation");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "implementation");
    await pick("live");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "live");
    await page.keyboard.press("Escape");
    await expect(page.locator("#letter")).toBeHidden();
    // the plane keeps focus after the letter closes (so it holds still), and it must still be drawn as a bird: a wing look and set wings
    await expect(page.locator(".plane")).toHaveAttribute("data-state", /^(glide|flap|perch)$/);
    await expect(page.locator(".plane .bw-near")).toHaveAttribute("transform", /matrix\(1 0 0 /);
  });

  test("the owner drags the knob along the progress bar; it settles on a stage, moves one step at most, and the bar fills up to it", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    const bar = page.locator("#stage-track .stage-bar");
    const at = async (fraction: number) => { const b = (await bar.boundingBox())!; return { x: b.x + b.width * fraction, y: b.y + b.height / 2 }; };
    const drag = async (from: number, to: number) => {
      const a = await at(from), z = await at(to);
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(z.x, z.y, { steps: 6 });
      return { release: () => page.mouse.up() };
    };
    const checked = () => page.locator("#stage-track input:checked").getAttribute("value");
    await expect(page.locator("#stage-track")).toHaveClass(/editable/);
    // mid-drag the stage it would settle on lights up; nothing is saved until the knob is let go
    const held = await drag(0, 0.4);
    await expect(page.locator('#stage-track label[data-stage="implementation"]')).toHaveClass(/target/);
    expect(board.stageMoves ?? []).toHaveLength(0);
    await held.release();
    await expect.poll(checked).toBe("implementation");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "implementation");
    expect(board.stageMoves).toHaveLength(1);
    // a short drag that stays nearer the starting stage changes nothing
    await (await drag(0.5, 0.6)).release();
    await page.waitForTimeout(300);
    expect(await checked()).toBe("implementation");
    expect(board.stageMoves).toHaveLength(1);
    // all the way to Live, then all the way back: one stage at a time
    await (await drag(0.5, 1)).release();
    await expect.poll(checked).toBe("live");
    await (await drag(1, 0)).release();
    await expect.poll(checked).toBe("implementation"); // not Idea: no jump
    expect(board.stageMoves).toHaveLength(3);
  });

  test("other people's ideas show their stage and form, with no way to move them", async ({ page }) => {
    await fakeServices(page, { rows: [{ ...gioRow, stage: "live", links: [{ title: "Market map", url: "https://markets.example.com/" }] }], posts: [], deletes: [], mails: 0 });
    await page.goto("/");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "live");
    await openOnly(page);
    await expect(page.locator('#stage-track label:has(input:checked)')).toContainText("Live");
    await expect(page.locator("#stage-track input:enabled")).toHaveCount(0);
    await expect(page.locator("#stage-track")).not.toHaveClass(/editable/);
    const b = (await page.locator("#stage-track .stage-bar").boundingBox())!; // dragging the knob of someone else's idea does nothing
    await page.mouse.move(b.x + b.width, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x, b.y + b.height / 2, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.locator("#stage-track input:checked")).toHaveAttribute("value", "live");
    await expect(page.locator("#letter-links a")).toHaveText(/Market map/);
  });

  test("if a move can't be saved, the stage stays and the letter says so", async ({ page }) => {
    const board = await fakeServices(page);
    await page.goto("/");
    await postWithLinks(page, []);
    await openOnly(page);
    board.stageDown = true;
    await page.locator('#stage-track label[data-stage="implementation"]').click();
    await expect(page.locator("#stage-error")).toContainText("Couldn’t move it");
    await expect(page.locator('#stage-track label:has(input:checked)')).toContainText("Idea");
    await expect(page.locator(".plane")).toHaveAttribute("data-stage", "idea");
  });
});
