import { describe, it, expect } from "vitest";
import { ideaLink, linkedIdeaId } from "../../src/lib/idea-link";

describe("a link to one idea", () => {
  it("is the page address with the idea's id after #idea-", () => {
    expect(ideaLink("https://rezoro05.github.io/IDEASKY/", "abc123")).toBe("https://rezoro05.github.io/IDEASKY/#idea-abc123");
  });
  it("drops whatever # part the page address already had", () => {
    expect(ideaLink("https://x.com/IDEASKY/#idea-old999", "abc123")).toBe("https://x.com/IDEASKY/#idea-abc123");
    expect(ideaLink("https://x.com/?q=1#top", "abc123")).toBe("https://x.com/?q=1#idea-abc123");
  });
  it("reads the idea back from the # part, and only a well-formed id", () => {
    expect(linkedIdeaId("#idea-abc123")).toBe("abc123");
    expect(linkedIdeaId(new URL(ideaLink("https://x.com/", "zzzzzz1")).hash)).toBe("zzzzzz1");
    for (const bad of ["", "#", "#idea-", "#idea-AB", "#idea-abc", "#idea-abc123<x>", "#top", "#idea-abc123/extra"]) expect(linkedIdeaId(bad), bad).toBeNull();
  });
});
