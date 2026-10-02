import { describe, it, expect } from "vitest";
import { classifyGesture } from "../../src/lib/gesture";
import { motionProfileFor } from "../../src/lib/motion";
import { mulberry32, hashString, seedFor } from "../../src/lib/random";
import { v, clampLen, len } from "../../src/lib/vec";
import { nameFromLocation, hrefFor, routeFromName, legacyHashTarget, routeName } from "../../src/lib/routing";

describe("classifyGesture", () => {
  const press = { point: v(0, 0), at: 0 };
  it("a short, still press opens", () => expect(classifyGesture(press, { point: v(3, 3), at: 200 })).toBe("open"));
  it("moving 6px or more is a drag", () => expect(classifyGesture(press, { point: v(6, 0), at: 100 })).toBe("drag"));
  it("holding 500ms or more is a drag", () => expect(classifyGesture(press, { point: v(0, 0), at: 500 })).toBe("drag"));
});

describe("motionProfileFor", () => {
  it("reduced motion always wins", () => expect(motionProfileFor({ prefersReducedMotion: true, viewportWidth: 2000 })).toBe("none"));
  it("phones get lite, wider screens full", () => {
    expect(motionProfileFor({ prefersReducedMotion: false, viewportWidth: 639 })).toBe("lite");
    expect(motionProfileFor({ prefersReducedMotion: false, viewportWidth: 640 })).toBe("full");
  });
});

describe("random", () => {
  it("is deterministic and in [0, 1)", () => {
    const a = mulberry32(1), b = mulberry32(1);
    for (let i = 0; i < 100; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it("hashes are stable unsigned ints", () => {
    expect(hashString("econsul")).toBe(hashString("econsul"));
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(seedFor("a", 5)).toBeGreaterThanOrEqual(0);
  });
});

describe("vec", () => {
  it("clampLen keeps direction and caps length", () => {
    expect(len(clampLen(v(30, 40), 10))).toBeCloseTo(10);
    expect(clampLen(v(3, 4), 10)).toEqual(v(3, 4));
  });
});

describe("routing", () => {
  const paths = { kind: "paths", base: "/" } as const, hash = { kind: "hash" } as const;
  const ideas = ["econsul", "momo"];
  it("reads names from paths and hashes", () => {
    expect(nameFromLocation({ pathname: "/", hash: "" }, paths)).toBe("home");
    expect(nameFromLocation({ pathname: "/about/", hash: "" }, paths)).toBe("about");
    expect(nameFromLocation({ pathname: "/econsul/index.html", hash: "" }, paths)).toBe("econsul");
    expect(nameFromLocation({ pathname: "/x/", hash: "#craft" }, hash)).toBe("craft");
    expect(nameFromLocation({ pathname: "/x/", hash: "" }, hash)).toBe("home");
  });
  it("works under a sub-path base", () => {
    const sub = { kind: "paths", base: "/Ideas-to-1/" } as const;
    expect(nameFromLocation({ pathname: "/Ideas-to-1/craft/", hash: "" }, sub)).toBe("craft");
    expect(hrefFor("craft", sub)).toBe("/Ideas-to-1/craft/");
    expect(hrefFor("home", sub)).toBe("/Ideas-to-1/");
  });
  it("writes hrefs", () => {
    expect(hrefFor("home", paths)).toBe("/");
    expect(hrefFor("momo", paths)).toBe("/momo/");
    expect(hrefFor("about", hash)).toBe("#about");
  });
  it("turns names into routes; ideas keep the view behind", () => {
    expect(routeFromName("about", ideas)).toEqual({ view: "about" });
    expect(routeFromName("econsul", ideas, "about")).toEqual({ view: "about", idea: "econsul" });
    expect(routeFromName("nope", ideas)).toEqual({ view: "home" });
    expect(routeName({ view: "craft", idea: "momo" })).toBe("momo");
  });
  it("redirects only known old #links", () => {
    expect(legacyHashTarget("#about", ["about"])).toBe("about");
    expect(legacyHashTarget("#top", ["about"])).toBeNull();
    expect(legacyHashTarget("", ["about"])).toBeNull();
  });
});
