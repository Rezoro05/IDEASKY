import { SITE } from "../content/site";
export function GET() {
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${SITE.url}sitemap.xml\n`, { headers: { "Content-Type": "text/plain" } });
}
