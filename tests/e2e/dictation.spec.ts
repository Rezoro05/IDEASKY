import { test, expect, type Page } from "@playwright/test";
import { fakeServices, settled } from "./fixtures";

/** A fake speech recognizer in place of the browser's: the test makes it "hear" words, refuse the mic, or end. */
async function fakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    type Part = { text: string; isFinal: boolean };
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
      start() { (window as any).__mic = this; (window as any).__micStarts = ((window as any).__micStarts ?? 0) + 1; }
      stop() { this.onend?.(); (window as any).__mic = null; }
      hear(parts: Part[]) { this.onresult?.({ results: parts.map((p) => Object.assign([{ transcript: p.text }], { isFinal: p.isFinal })) }); }
      fail(error: string) { this.onerror?.({ error }); this.onend?.(); (window as any).__mic = null; }
    }
    (window as any).SpeechRecognition = FakeRecognition;
  });
}
const hear = (page: Page, parts: { text: string; isFinal: boolean }[]) => page.evaluate((p) => (window as any).__mic.hear(p), parts);

test.describe("dictation in the Idea Note", () => {
  test("speak: words appear in the idea field after what was typed, and the mic stops on a second tap", async ({ page }) => {
    await fakeServices(page);
    await fakeMicrophone(page);
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    const mic = page.locator("#note-mic"), field = page.locator("#note-msg");
    await expect(mic).toBeVisible();
    await expect(page.locator(".mic-hint")).toContainText("speech service");
    await field.fill("Night markets.");
    await mic.click();
    await expect(mic).toHaveAttribute("aria-pressed", "true");
    await expect(mic).toContainText("Listening");
    await hear(page, [{ text: "open late ", isFinal: true }, { text: "in every bor", isFinal: false }]);
    await expect(field).toHaveValue("Night markets. Open late in every bor");
    await hear(page, [{ text: "open late ", isFinal: true }, { text: "in every borough", isFinal: true }]);
    await expect(field).toHaveValue("Night markets. Open late in every borough");
    await mic.click();
    await expect(mic).toHaveAttribute("aria-pressed", "false");
    await expect(mic).toContainText("Speak your idea");
    expect(await page.evaluate(() => (window as any).__mic)).toBeNull();
  });

  test("a refused microphone says how to allow it; the message goes when the note is opened again", async ({ page }) => {
    await fakeServices(page);
    await fakeMicrophone(page);
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-mic").click();
    await page.evaluate(() => (window as any).__mic.fail("not-allowed"));
    await expect(page.locator("#note-mic-status")).toHaveText(/microphone is blocked/);
    await expect(page.locator("#note-mic")).toHaveAttribute("aria-pressed", "false");
    await page.locator("#note-close").click();
    await page.locator("#idea-btn").click(); await settled(page);
    await expect(page.locator("#note-mic-status")).toBeHidden();
  });

  test("sending the idea or typing stops the mic", async ({ page }) => {
    await fakeServices(page);
    await fakeMicrophone(page);
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    await page.locator("#note-mic").click();
    await hear(page, [{ text: "a map of quiet cafes", isFinal: true }]);
    await page.locator("#note-msg").press("End");
    await page.keyboard.type("!");
    await expect(page.locator("#note-mic")).toHaveAttribute("aria-pressed", "false"); // typing took over
    await expect(page.locator("#note-msg")).toHaveValue("A map of quiet cafes!");
    await page.locator("#note-mic").click();
    await page.locator(".note-send").click();
    await expect(page.locator("#compose")).toBeHidden();
    expect(await page.evaluate(() => (window as any).__mic)).toBeNull();
  });

  test("browsers without speech recognition don't show the mic", async ({ page }) => {
    await fakeServices(page);
    await page.addInitScript(() => { delete (window as any).SpeechRecognition; delete (window as any).webkitSpeechRecognition; });
    await page.goto("/");
    await page.locator("#idea-btn").click(); await settled(page);
    await expect(page.locator("#note-mic")).toBeHidden();
    await expect(page.locator(".mic-hint")).toBeHidden();
  });
});
