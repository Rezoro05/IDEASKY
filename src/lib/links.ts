/** Pure rules for links on an idea: a title and a web address. Only http and https are allowed,
 *  so a visitor can't post a link that runs script (javascript:) or embeds data (data:). */

export type Link = { title: string; url: string };

export const LINK_LIMITS = { perIdea: 5, title: 80, url: 500 } as const;

/** The site's name for a link with no title: the host without "www.". */
export function siteName(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** A web address as typed, made absolute when it plainly is one ("example.com/x" → "https://example.com/x"); null if it isn't http(s). */
export function webAddress(typed: string): string | null {
  const t = typed.trim();
  if (!t || t.length > LINK_LIMITS.url || /\s/.test(t)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(t) ? "https://" + t : null;
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".") ? u.href : null;
  } catch { return null; }
}

/** Untrusted data in, a safe link (or null) out. */
export function cleanLink(raw: unknown): Link | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url = typeof r.url === "string" ? webAddress(r.url) : null;
  if (!url) return null;
  const title = typeof r.title === "string" ? r.title.trim().slice(0, LINK_LIMITS.title) : "";
  return { title: title || siteName(url), url };
}

/** Keeps the good links, in order, at most five. The same address may appear twice. */
export function cleanLinks(raw: unknown): Link[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(cleanLink).filter((l): l is Link => l !== null).slice(0, LINK_LIMITS.perIdea);
}

export type LinkRow = { title: string; url: string };
export type LinkRowsCheck = { ok: true; links: Link[] } | { ok: false; row: number; text: string };

/** What a visitor typed in the link rows: blank rows are skipped; a row with an address that isn't a web address is an error. */
export function checkLinkRows(rows: readonly LinkRow[]): LinkRowsCheck {
  const links: Link[] = [];
  for (const [i, row] of rows.entries()) {
    if (!row.url.trim() && !row.title.trim()) continue;
    const link = cleanLink(row);
    if (!link) return { ok: false, row: i, text: "That link isn’t a web address. Try something like example.com." };
    links.push(link);
  }
  return { ok: true, links: links.slice(0, LINK_LIMITS.perIdea) };
}
