import { SITE } from "../content/site";
export function GET() {
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + `  <url><loc>${SITE.url}</loc></url>\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
