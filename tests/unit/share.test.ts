import { describe, it, expect, vi } from "vitest";
import { shareLink, type ShareNav } from "../../src/boundaries/share";

const link = { title: "IDEA SKY", url: "https://example.com/" };
const abort = () => Promise.reject(Object.assign(new Error("x"), { name: "AbortError" }));

describe("sharing a link", () => {
  it("uses the share sheet on touch-first devices", async () => {
    const nav = { share: vi.fn(() => Promise.resolve()), clipboard: { writeText: vi.fn(() => Promise.resolve()) } };
    expect(await shareLink(link, nav, true)).toBe("shared");
    expect(nav.share).toHaveBeenCalledWith(link);
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });
  it("copies on desktop even when a share sheet exists", async () => {
    const nav = { share: vi.fn(() => Promise.resolve()), clipboard: { writeText: vi.fn(() => Promise.resolve()) } };
    expect(await shareLink(link, nav, false)).toBe("copied");
    expect(nav.clipboard.writeText).toHaveBeenCalledWith(link.url);
    expect(nav.share).not.toHaveBeenCalled();
  });
  it("closing the share sheet is not a failure, and copies nothing", async () => {
    const nav = { share: vi.fn(abort), clipboard: { writeText: vi.fn(() => Promise.resolve()) } };
    expect(await shareLink(link, nav, true)).toBe("cancelled");
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });
  it("falls back to copying when the share sheet breaks", async () => {
    const nav: ShareNav = { share: () => Promise.reject(new Error("not allowed")), clipboard: { writeText: () => Promise.resolve() } };
    expect(await shareLink(link, nav, true)).toBe("copied");
  });
  it("says it failed when nothing works, without throwing", async () => {
    expect(await shareLink(link, {}, false)).toBe("failed");
    expect(await shareLink(link, { clipboard: { writeText: () => Promise.reject(new Error("denied")) } }, false)).toBe("failed");
  });
});
