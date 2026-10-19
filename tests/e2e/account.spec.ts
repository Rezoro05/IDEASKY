import { test, expect } from "@playwright/test";
import { fakeServices, settled, signInReturn, watchErrors, type Board } from "./fixtures";

const fresh = (): Board => ({ rows: [], posts: [], deletes: [], mails: 0 });

test.describe("sign-in (email link)", () => {
  test("Sign in opens a note; an email gets a link that comes back to this page, and the note says where it went", async ({ page }) => {
    const board = await fakeServices(page, fresh());
    await page.goto("/#sea");
    await expect(page.locator("#account-me")).toBeHidden(); // signed out: only the link shows
    await page.locator("#account-signin").click(); await settled(page);
    await expect(page.locator("#signin-email")).toBeFocused();
    await page.locator("#signin-email").fill("  Rez@Example.com ");
    await page.locator(".signin-send").click();
    await expect(page.locator("#signin-sent")).toBeVisible();
    await expect(page.locator("#signin-to")).toHaveText("rez@example.com");
    expect(board.signInLinks).toEqual([{ email: "rez@example.com", redirect: "http://127.0.0.1:4329/" }]); // no #sea: the link comes back clean
    await page.locator("#signin-again").click();
    await expect(page.locator("#signin-email")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#signin")).toBeHidden();
    await expect(page.locator("#account-signin")).toBeFocused();
  });

  test("a wrong address is caught before sending; too many emails and a failure say so and keep the text", async ({ page }) => {
    const board = await fakeServices(page, fresh());
    await page.goto("/");
    await page.locator("#account-signin").click(); await settled(page);
    await page.locator("#signin-email").fill("rez@example");
    await page.locator(".signin-send").click();
    await expect(page.locator("#signin-error")).toHaveText("That doesn’t look like an email address.");
    expect(board.signInLinks ?? []).toHaveLength(0);
    await page.locator("#signin-email").fill("rez@example.com");
    await expect(page.locator("#signin-error")).toBeHidden(); // editing clears the message
    board.signInStatus = 429;
    await page.locator(".signin-send").click();
    await expect(page.locator("#signin-error")).toHaveText("Too many sign-in emails just now. Try again in a few minutes.");
    board.signInStatus = 500;
    await page.locator(".signin-send").click();
    await expect(page.locator("#signin-error")).toHaveText("Couldn’t send the link just now. Try again in a moment.");
    await expect(page.locator("#signin-email")).toHaveValue("rez@example.com");
  });

  test("coming back from the link signs in: the initial shows, the address is clean, a reload remembers; Sign out ends it", async ({ page }) => {
    const board = await fakeServices(page, fresh());
    const errors = watchErrors(page);
    await page.goto("/" + signInReturn("rez@example.com"));
    await expect(page.locator("#account-me")).toBeVisible();
    await expect(page.locator("#account-initial")).toHaveText("R");
    await expect(page.locator("#account-signin")).toBeHidden();
    await expect(page.locator("#toast")).toHaveText("Signed in as rez@example.com.");
    await expect(page).toHaveURL("http://127.0.0.1:4329/");
    await page.reload();
    await expect(page.locator("#account-me")).toBeVisible();
    await page.locator("#account-me").click();
    await expect(page.locator("#account-email")).toHaveText("rez@example.com");
    await page.locator("#account-signout").click();
    await expect(page.locator("#account-signin")).toBeVisible();
    await expect(page.locator("#toast")).toHaveText("Signed out.");
    expect(board.signOuts).toBe(1);
    await page.reload();
    await expect(page.locator("#account-signin")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Continue with Google shows only once Google is turned on, and comes back signed in", async ({ page }) => {
    const board = await fakeServices(page, fresh());
    await page.goto("/");
    await page.locator("#account-signin").click(); await settled(page);
    await expect(page.locator("#signin-email")).toBeVisible();
    await expect(page.locator("#signin-google")).toBeHidden(); // not set up in Supabase yet: no button that would fail
    await page.keyboard.press("Escape");
    board.google = true; // turned on in Supabase: the next visit offers it
    await page.reload();
    await page.locator("#account-signin").click(); await settled(page);
    await page.locator("#signin-google").click();
    await expect(page.locator("#account-initial")).toHaveText("R");
    await expect(page.locator("#toast")).toHaveText("Signed in as rez@gmail.com.");
    expect(board.googleTrips).toEqual(["http://127.0.0.1:4329/"]);
    await expect(page).toHaveURL("http://127.0.0.1:4329/");
  });

  test("an expired link says so and leaves the visitor signed out", async ({ page }) => {
    await fakeServices(page, fresh());
    await page.goto("/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    await expect(page.locator("#toast")).toHaveText("That sign-in link has expired or was already used. Ask for a new one.");
    await expect(page.locator("#account-signin")).toBeVisible();
    await expect(page).toHaveURL("http://127.0.0.1:4329/");
  });

  test("the account sits top right in the sky and the sea, and the menu closes with Escape", async ({ page }) => {
    await fakeServices(page, fresh());
    await page.goto("/" + signInReturn("rez@example.com"));
    const vp = page.viewportSize()!, box = (await page.locator("#account-me").boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(vp.width - 60); expect(box.y).toBeLessThan(30);
    await page.locator("#account-me").click();
    await expect(page.locator("#account-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#account-menu")).toBeHidden();
    await expect(page.locator("#account-me")).toBeFocused();
    await page.locator("#dive-btn").click();
    await expect(page.locator("#account-me")).toBeInViewport();
  });
});
