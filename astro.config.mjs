// One build: dist/ is the static site. Service endpoints come from PUBLIC_* environment variables (see src/content/site.ts).
import { defineConfig } from "astro/config";
export default defineConfig({
  site: "https://rezoro05.github.io",
  outDir: "./dist",
  trailingSlash: "always",
  build: { format: "directory", inlineStylesheets: "always" },
  compressHTML: true,
  devToolbar: { enabled: false },
});
