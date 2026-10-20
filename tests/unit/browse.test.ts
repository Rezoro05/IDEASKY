import { describe, it, expect } from "vitest";
import { browseList, categoriesIn, recordNumbers, OLDER_PAGE } from "../../src/lib/browse";
import { IDEA_CATEGORIES } from "../../src/lib/categories";
import { likeScale, LIKE_GROWTH } from "../../src/lib/likes";
import type { Idea } from "../../src/lib/ideas";

const idea = (id: string, at: number, categories?: string[]): Idea => ({ id, name: "x", message: "m " + id, at, stage: "idea", links: [], ...(categories ? { categories } : {}) });

describe("browsing every idea", () => {
  it("numbers count from the oldest of all, so loading older ones never renumbers the newest", () => {
    const newest = [idea("c3", 30), idea("c2", 20)];
    const before = recordNumbers(newest, 5); // 7 in all, the newest 2 loaded: they are Idea6 and Idea7
    expect(Object.fromEntries(before)).toEqual({ c2: 6, c3: 7 });
    const after = recordNumbers([...newest, idea("b1", 10), idea("b0", 5)], 3); // two older loaded: base drops by two
    expect(after.get("c3")).toBe(7);
    expect(after.get("b0")).toBe(4);
    expect(Object.fromEntries(recordNumbers(newest, 0))).toEqual({ c2: 1, c3: 2 }); // unknown total: from 1, as before
  });
  it("lists newest first, one category at a time if chosen", () => {
    const all = [idea("a", 1, ["tech"]), idea("b", 3, ["health", "tech"]), idea("c", 2)];
    expect(browseList(all, null).map((n) => n.id)).toEqual(["b", "c", "a"]);
    expect(browseList(all, "tech").map((n) => n.id)).toEqual(["b", "a"]);
    expect(browseList(all, "science")).toEqual([]);
  });
  it("offers only categories that something has, in the list's own order", () => {
    expect(categoriesIn([idea("a", 1, ["science", "tech"]), idea("b", 2)], IDEA_CATEGORIES).map((c) => c.key)).toEqual(["tech", "science"]);
  });
  it("asks for older ones a page at a time", () => expect(OLDER_PAGE).toBe(30));
});

describe("a liked idea or dream grows a little", () => {
  it("6% a like, up to 60% bigger", () => {
    expect(likeScale(0)).toBe(1);
    expect(likeScale(1)).toBeCloseTo(1.06);
    expect(likeScale(5)).toBeCloseTo(1.3);
    expect(likeScale(10)).toBeCloseTo(1 + LIKE_GROWTH.most);
    expect(likeScale(500)).toBeCloseTo(1.6);
    expect(likeScale(-3)).toBe(1);
  });
});
