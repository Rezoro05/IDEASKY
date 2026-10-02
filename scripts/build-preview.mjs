// Turns dist-preview/index.html into one self-contained page for the claude.ai review preview:
// the script is inlined, the document skeleton is dropped (the preview adds its own), images stay as files next to it.
import { readFile, writeFile } from "node:fs/promises";
const dir = "dist-preview/";
let html = await readFile(dir + "index.html", "utf8");
const scriptTag = /<script type="module" src="\/(_astro\/[^"]+\.js)"><\/script>/;
const m = html.match(scriptTag);
if (!m) throw new Error("preview build: script tag not found");
const js = (await readFile(dir + m[1], "utf8")).replace(/<\/script/gi, "<\\/script");
html = html.replace(scriptTag, () => `<script type="module">${js}</script>`);
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset="utf-8">|<meta name="viewport"[^>]*>|<link rel="canonical"[^>]*>/g, "");
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
await writeFile(dir + "preview.html", head + body);
console.log("preview.html", Math.round((head + body).length / 1024) + " KB");
