import { IDEAS } from "../content/ideas";
import { SITE } from "../content/site";
export function GET() {
  const urls = ["", "about/", "craft/", ...IDEAS.map((i) => i.slug + "/")].map((p) => SITE.url + p);
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map((u) => `  <url><loc>${u}</loc></url>\n`).join("") + "</urlset>\n";
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
