import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4329", launchOptions: { executablePath: "/opt/pw-browsers/chromium" } },
  webServer: { command: "node tests/serve.mjs dist 4329", url: "http://127.0.0.1:4329/", reuseExistingServer: true },
});
