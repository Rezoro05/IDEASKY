// Two builds from one source:
//   site    → dist/          real page URLs, the live site (revazkuparadze.com)
//   preview → dist-preview/  one page with #hash links, inlined into the claude.ai preview
import { defineConfig } from "astro/config";
const preview = process.env.SITE_MODE === "preview";
export default defineConfig({
  site: "https://revazkuparadze.com",
  outDir: preview ? "./dist-preview" : "./dist",
  trailingSlash: "always",
  build: { format: "directory", inlineStylesheets: "always" },
  compressHTML: true,
  devToolbar: { enabled: false },
});
