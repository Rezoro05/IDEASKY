import { describe, it, expect } from "vitest";
import { demoIdeas } from "../../src/content/demo-ideas";
import { STAGES } from "../../src/lib/stages";
import { IDEA_LIMITS, isRecordId } from "../../src/lib/ideas";

describe("the example ideas", () => {
  const ideas = demoIdeas(1_700_000_000_000);
  it("are five, with every stage represented", () => {
    expect(ideas).toHaveLength(5);
    for (const stage of STAGES) expect(ideas.some((i) => i.stage === stage)).toBe(true);
  });
  it("have valid, distinct ids and fit the limits", () => {
    expect(new Set(ideas.map((i) => i.id)).size).toBe(5);
    for (const i of ideas) {
      expect(isRecordId(i.id)).toBe(true);
      expect(i.message.length).toBeLessThanOrEqual(IDEA_LIMITS.message);
      expect(i.name.length).toBeLessThanOrEqual(IDEA_LIMITS.name);
    }
  });
  it("are all dated before now", () => {
    for (const i of ideas) expect(i.at).toBeLessThan(1_700_000_000_000);
  });
});
