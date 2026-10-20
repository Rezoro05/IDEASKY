import { describe, it, expect } from "vitest";
import { alertFor } from "../../supabase/functions/_shared/alert";

const SITE = "https://rezoro05.github.io/IDEASKY/";

describe("the owner's email for something new", () => {
  it("an idea: its text, links, who posted it, and a link to open it; replies go to the poster when they left an email", () => {
    const a = alertFor({ type: "idea", id: "abc123", name: "Nino", message: "Night markets", email: "nino@example.com", links: [{ title: "x", url: "https://demo.app/" }, { url: "javascript:alert(1)" }] }, SITE)!;
    expect(a.subject).toBe("New idea on Sky of Ideas from Nino");
    expect(a.text).toBe("Night markets\n\nLink: https://demo.app/\nFrom: Nino <nino@example.com>\nOpen it: https://rezoro05.github.io/IDEASKY/#idea-abc123");
    expect(a.replyTo).toBe("nino@example.com");
  });
  it("a dream has its own subject; no email means no reply-to", () => {
    const a = alertFor({ type: "dream", id: "abc123", name: "", message: "I could fly" }, SITE)!;
    expect(a.subject).toBe("New dream in the Sea of Dreams from Anonymous");
    expect(a).not.toHaveProperty("replyTo");
  });
  it("a comment names the post it is on", () => {
    const a = alertFor({ type: "comment", id: "cmt001", idea_id: "abc123", idea_name: "Gio", name: "Nino", message: "Love it" }, SITE)!;
    expect(a.subject).toBe("New comment from Nino on Gio's post");
    expect(a.text).toContain("#idea-abc123");
  });
  it("anything else gets no email", () => {
    for (const bad of [null, "x", {}, { type: "idea", id: "ABC", message: "x" }, { type: "idea", id: "abc123", message: "  " }, { type: "comment", id: "cmt001", message: "x" }, { type: "feedback", id: "abc123", message: "x" }])
      expect(alertFor(bad, SITE)).toBeNull();
  });
});
