/** Views, idea sheets, titles and the URL. The URL is the single source of truth for what's on screen. */
import { IDEA_SLUGS, ideaBySlug } from "../content/ideas";
import { PAGE_META, SITE } from "../content/site";
import { hrefFor, legacyHashTarget, nameFromLocation, routeFromName, VIEWS, type UrlMode, type View } from "../lib/routing";
import { factsHtml, ideaEyebrow, ideaLinkText, ideaMediaHtml } from "../lib/views";
import type { Vec } from "../lib/vec";
import { byId, closeAfterTransition, openWithTransition } from "./dom";

export type Router = {
  readonly mode: UrlMode;
  href(name: string): string;
  go(name: string): void;
  openIdea(slug: string, origin?: Vec): void;
  currentView(): View;
  /** The sky only flies while the home view is showing and no idea is open. */
  skyVisible(): boolean;
  start(): void;
};

const TITLES: Record<View, string> = { home: PAGE_META.home.title, about: PAGE_META.about.title, craft: PAGE_META.craft.title };
const KNOWN = [...VIEWS, ...IDEA_SLUGS];

export function urlModeOf(doc: Document): UrlMode {
  return doc.querySelector('meta[name="site-mode"][content="paths"]')
    ? { kind: "paths", base: new URL(".", doc.baseURI).pathname }
    : { kind: "hash" };
}

export function createRouter(mode: UrlMode): Router {
  const sheet = byId("sheet"), back = byId("back");
  const views: Record<View, HTMLElement> = { home: byId("view-home"), about: byId("view-about"), craft: byId("view-craft") };
  let view: View = "home";
  const href = (name: string) => hrefFor(name, mode);
  const nameNow = () => nameFromLocation(location, mode);

  function fillSheet(slug: string): void {
    const idea = ideaBySlug(slug);
    if (!idea) return;
    byId("sheet-eyebrow").textContent = ideaEyebrow(idea);
    byId("sheet-title").textContent = idea.title;
    byId("sheet-lede").textContent = idea.lede;
    byId("sheet-facts").innerHTML = factsHtml(idea.facts);
    const icon = byId<HTMLImageElement>("sheet-icon");
    icon.hidden = !idea.icon;
    if (idea.icon) icon.src = idea.icon;
    const link = byId<HTMLAnchorElement>("sheet-link");
    link.hidden = !idea.url;
    if (idea.url) { link.href = idea.url; link.textContent = ideaLinkText(idea); }
    byId("sheet-media").innerHTML = ideaMediaHtml(idea);
  }

  function openIdea(slug: string, origin?: Vec): void {
    const idea = ideaBySlug(slug);
    if (!idea) return;
    fillSheet(slug);
    sheet.style.setProperty("--ox", origin ? origin.x + "px" : "50%");
    sheet.style.setProperty("--oy", origin ? origin.y + "px" : "50%");
    openWithTransition(sheet);
    if (nameNow() !== slug) history.pushState(null, "", href(slug));
    document.title = `${idea.title} · ${SITE.owner}`;
    back.focus({ preventScroll: true });
  }

  const closeIdea = () => closeAfterTransition(sheet, 700);

  function render(): void {
    if (mode.kind === "paths") {
      const legacy = legacyHashTarget(location.hash, KNOWN);
      if (legacy) history.replaceState(null, "", href(legacy)); // old #links keep working
    }
    const route = routeFromName(nameNow(), IDEA_SLUGS, view);
    const changed = route.view !== view;
    view = route.view;
    for (const [k, el] of Object.entries(views)) el.hidden = k !== view;
    document.querySelectorAll<HTMLElement>("[data-route]").forEach((a) => a.toggleAttribute("aria-current", a.dataset.route === view && !route.idea));
    if (route.idea) openIdea(route.idea);
    else { if (!sheet.hidden) closeIdea(); document.title = TITLES[view]; }
    if (changed) window.scrollTo(0, 0);
  }

  function go(name: string): void {
    if (nameNow() !== name) history.pushState(null, "", href(name));
    render();
  }

  return {
    mode, href, go, openIdea,
    currentView: () => view,
    skyVisible: () => sheet.hidden && !views.home.hidden,
    start() {
      back.addEventListener("click", () => { closeIdea(); history.pushState(null, "", href(view)); document.title = TITLES[view]; });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) back.click(); });
      // Every in-site link has a real href; on the live site clicks stay in the page (hash links work natively in the preview).
      document.addEventListener("click", (e) => {
        const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-route]");
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0 || mode.kind !== "paths") return;
        e.preventDefault();
        go(a.dataset.route!);
      });
      byId("ideas").addEventListener("click", (e) => {
        const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-slug]");
        if (!a) return;
        e.preventDefault();
        const r = a.getBoundingClientRect();
        openIdea(a.dataset.slug!, { x: r.left + 40, y: r.top + r.height / 2 });
      });
      window.addEventListener("popstate", render);
      window.addEventListener("hashchange", render);
      render();
    },
  };
}
