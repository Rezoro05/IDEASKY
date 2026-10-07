import { describe, it, expect } from "vitest";
import { fishPressOutcome, netSpot, waterTapReleases } from "../../src/lib/net";

describe("catching a dream", () => {
  it("a quick tap on a fish opens it, netted or not", () => {
    expect(fishPressOutcome({ gesture: "open", overNet: false, canceled: false })).toBe("open");
    expect(fishPressOutcome({ gesture: "open", overNet: true, canceled: false })).toBe("open");
  });
  it("a fish dragged into the net stays in it", () => {
    expect(fishPressOutcome({ gesture: "drag", overNet: true, canceled: false })).toBe("net");
  });
  it("a fish let go anywhere else, or taken from the hand, swims free", () => {
    expect(fishPressOutcome({ gesture: "drag", overNet: false, canceled: false })).toBe("free");
    expect(fishPressOutcome({ gesture: "drag", overNet: true, canceled: true })).toBe("free");
    expect(fishPressOutcome({ gesture: "open", overNet: false, canceled: true })).toBe("free");
  });
  it("a tap on the water lets netted fish go; a drag doesn't", () => {
    expect(waterTapReleases("open")).toBe(true);
    expect(waterTapReleases("drag")).toBe(false);
  });
  it("netted fish rest inside the net, side by side", () => {
    const net = { x: 1000, y: 70, width: 52, height: 59 };
    const spots = [0, 1, 2].map((i) => netSpot(net, i));
    for (const s of spots) { expect(s.x).toBeGreaterThan(net.x - 20); expect(s.x).toBeLessThan(net.x + net.width + 20); expect(s.y).toBeGreaterThan(net.y); expect(s.y).toBeLessThan(net.y + net.height); }
    expect(spots[0]!.x).toBe(1026);
    expect(spots[1]!.x).toBeLessThan(spots[0]!.x);
    expect(spots[2]!.x).toBeGreaterThan(spots[0]!.x);
  });
});
