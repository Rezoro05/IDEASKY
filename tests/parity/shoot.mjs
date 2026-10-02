// Screenshot every page of a built site at desktop and phone widths.
// usage: node tests/parity/shoot.mjs <siteDir> <outDir>
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, mkdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
const [siteDir, outDir] = process.argv.slice(2);
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".xml": "application/xml", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
  let p = join(siteDir, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, "index.html"); res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" }); res.end(await readFile(p)); }
  catch { res.writeHead(404, { "content-type": "text/html" }); res.end(await readFile(join(siteDir, "404.html"))); }
}).listen(0);
const port = server.address().port;
const PAGES = ["", "about/", "craft/", "econsul/", "ephoto/", "greencard/", "momo/"];
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [size, viewport] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  for (const p of PAGES) {
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/${p}`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(outDir, `${size}-${p.replace(/\/$/, "") || "home"}.png`) });
    await page.setViewportSize(viewport);
    await page.close();
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log("shot", PAGES.length * 2, "pages into", outDir);
