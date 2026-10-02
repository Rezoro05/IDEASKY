// Tiny static server for a built site folder, GitHub Pages style (folder → index.html, unknown → 404.html).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".xml": "application/xml", ".webp": "image/webp", ".txt": "text/plain" };
export function serve(dir, port = 0) {
  return createServer(async (req, res) => {
    let p = join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname));
    try {
      if ((await stat(p)).isDirectory()) p = join(p, "index.html");
      const body = await readFile(p);
      res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" }); res.end(body);
    } catch { res.writeHead(404, { "content-type": "text/html" }); res.end(await readFile(join(dir, "404.html"))); }
  }).listen(port);
}
if (process.argv[1].endsWith("serve.mjs")) { serve(process.argv[2] || "dist", Number(process.argv[3] || 4321)); console.log("serving"); }
