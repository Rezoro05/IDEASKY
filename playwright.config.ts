import { defineConfig } from "@playwright/test";
/** Two builds of the same site (npm run build:test makes both):
 *  - "full": stages shown (PUBLIC_SHOW_STAGES=1), served from dist/: every feature, as most tests need.
 *  - "public": the public board as deployed (stages hidden), served from dist-public/: only tests/e2e/public.spec.ts. */
const launchOptions = { executablePath: "/opt/pw-browsers/chromium" };
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  projects: [
    { name: "full", testIgnore: /public\.spec\.ts/, use: { baseURL: "http://127.0.0.1:4329", launchOptions } },
    { name: "public", testMatch: /public\.spec\.ts/, use: { baseURL: "http://127.0.0.1:4330", launchOptions } },
  ],
  webServer: [
    { command: "node tests/serve.mjs dist 4329", url: "http://127.0.0.1:4329/", reuseExistingServer: true },
    { command: "node tests/serve.mjs dist-public 4330", url: "http://127.0.0.1:4330/", reuseExistingServer: true },
  ],
});
