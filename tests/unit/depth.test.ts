import { describe, it, expect } from "vitest";
import { DIVE, NO_WHEEL, depthFromHash, keyStep, swipeStep, wheelStep, type Depth, type Wheel } from "../../src/lib/depth";

/** Feeds wheel events (deltaY, ms since the last one) and returns where the visitor ends up. */
function wheel(depth: Depth, events: [number, number][], start = 10_000): { depth: Depth; state: Wheel } {
  let state = NO_WHEEL, now = start;
  for (const [delta, gap] of events) { now += gap; ({ depth, wheel: state } = wheelStep(depth, state, delta, now)); }
  return { depth, state };
}

describe("wheel", () => {
  it("scrolling down far enough in the sky dives", () => {
    expect(wheel("sky", [[60, 16], [60, 16], [60, 16]]).depth).toBe("sea");
  });
  it("a small nudge doesn't", () => {
    expect(wheel("sky", [[40, 16], [40, 16]]).depth).toBe("sky");
  });
  it("scrolling up in the sea surfaces; scrolling up in the sky does nothing", () => {
    expect(wheel("sea", [[-80, 16], [-80, 16]]).depth).toBe("sky");
    expect(wheel("sky", [[-500, 16]]).depth).toBe("sky");
  });
  it("a pause starts a new gesture, so slow small scrolls never add up", () => {
    expect(wheel("sky", [[60, 16], [60, DIVE.wheelGapMs + 50], [60, DIVE.wheelGapMs + 50]]).depth).toBe("sky");
  });
  it("one long flick dives once and doesn't bounce back up right after", () => {
    const dived = wheel("sky", [[200, 16]]);
    expect(dived.depth).toBe("sea");
    let { depth, state } = dived;
    ({ depth, wheel: state } = wheelStep(depth, state, -300, 10_016 + 100));
    expect(depth).toBe("sea");
    ({ depth } = wheelStep(depth, state, -300, 10_016 + DIVE.lockMs + 400));
    expect(depth).toBe("sky");
  });
});

describe("swipes and keys", () => {
  it("swiping up in the sky dives; swiping down in the sea surfaces", () => {
    expect(swipeStep("sky", DIVE.swipePx)).toBe("sea");
    expect(swipeStep("sea", -DIVE.swipePx)).toBe("sea"); // in the sea a drag is the net, not a swipe
    expect(swipeStep("sky", DIVE.swipePx - 1)).toBe("sky");
    expect(swipeStep("sea", 300)).toBe("sea");
  });
  it("Page Down dives and Page Up surfaces; other keys change nothing", () => {
    expect(keyStep("sky", "PageDown")).toBe("sea");
    expect(keyStep("sea", "PageUp")).toBe("sky");
    expect(keyStep("sea", "ArrowDown")).toBe("sea");
  });
  it("a #sea link starts in the sea", () => {
    expect(depthFromHash("#sea")).toBe("sea");
    expect(depthFromHash("#idea-abc123")).toBe("sky");
    expect(depthFromHash("")).toBe("sky");
  });
});
