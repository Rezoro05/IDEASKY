/** Renders links (an idea's or an update's) as list items that open safely in a new tab, with the site's name beside each. */
import { siteName, type Link } from "../lib/links";

export function linkItems(links: readonly Link[]): HTMLLIElement[] {
  return links.map((l) => {
    const li = document.createElement("li"), a = document.createElement("a"), site = document.createElement("span");
    a.href = l.url; a.target = "_blank"; a.rel = "noopener noreferrer nofollow ugc"; a.textContent = l.title;
    site.className = "site"; site.textContent = siteName(l.url);
    a.append(site); li.append(a);
    return li;
  });
}
