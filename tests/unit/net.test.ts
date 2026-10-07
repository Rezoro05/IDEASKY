import { describe, it, expect } from "vitest";
import { NET, fishRelease, netsNow, waterTapReleases } from "../../src/lib/net";

describe("catching a dream", () => {
  it("a quick tap on a free fish opens it", () => {
    expect(fishRelease({ moved: 2, nettedBefore: false, nettedDuring: false })).toBe("open");
  });
  it("holding still long enough nets it, and letting go then keeps it in the net", () => {
    expect(netsNow(NET.holdMs - 1, 0)).toBe(false);
    expect(netsNow(NET.holdMs, 3)).toBe(true);
    expect(fishRelease({ moved: 3, nettedBefore: false, nettedDuring: true })).toBe("keep");
  });
  it("a hold that slides away neither nets nor opens", () => {
    expect(netsNow(NET.holdMs * 2, NET.slack + 1)).toBe(false);
    expect(fishRelease({ moved: NET.slack + 1, nettedBefore: false, nettedDuring: false })).toBe("none");
  });
  it("tapping a netted fish opens it", () => {
    expect(fishRelease({ moved: 0, nettedBefore: true, nettedDuring: false })).toBe("open");
  });
  it("a tap on the water lets netted fish go; a drag doesn't", () => {
    expect(waterTapReleases(4)).toBe(true);
    expect(waterTapReleases(40)).toBe(false);
  });
});
