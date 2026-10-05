import { describe, it, expect } from "vitest";
import { deployMode, SERVICE_VARIABLES } from "../../scripts/deploy-mode.mjs";

const all = { PUBLIC_BOARD_URL: "https://x.supabase.co", PUBLIC_BOARD_KEY: "sb_publishable_x", PUBLIC_FORMSPREE_ENDPOINT: "https://formspree.io/f/x" };

describe("what the deploy builds", () => {
  it("is the live site when all three services are set", () => expect(deployMode(all)).toEqual({ mode: "live" }));
  it("is a preview with example ideas when none is set (missing or empty, as an unset repo Variable arrives)", () => {
    const preview = { mode: "preview", buildEnv: { PUBLIC_DEMO_IDEAS: "1" } };
    expect(deployMode({})).toEqual(preview);
    expect(deployMode({ PUBLIC_BOARD_URL: "", PUBLIC_BOARD_KEY: "", PUBLIC_FORMSPREE_ENDPOINT: "" })).toEqual(preview);
  });
  it("refuses a half-configured deploy and names exactly what is missing", () => {
    expect(deployMode({ ...all, PUBLIC_FORMSPREE_ENDPOINT: "" })).toEqual({ mode: "error", missing: ["PUBLIC_FORMSPREE_ENDPOINT"] });
    expect(deployMode({ PUBLIC_BOARD_URL: all.PUBLIC_BOARD_URL })).toEqual({ mode: "error", missing: ["PUBLIC_BOARD_KEY", "PUBLIC_FORMSPREE_ENDPOINT"] });
  });
  it("counts a blank (spaces only) value as not set", () => expect(deployMode({ ...all, PUBLIC_BOARD_KEY: "   " })).toEqual({ mode: "error", missing: ["PUBLIC_BOARD_KEY"] }));
  it("knows the three services", () => expect([...SERVICE_VARIABLES].sort()).toEqual(Object.keys(all).sort()));
});
