/** Pure URL rules. The live site uses real paths (/about/); the claude.ai preview is one file and uses #about. */

export type View = "home" | "about" | "craft";
export type Route = { view: View; idea?: string };
export type UrlMode = { kind: "paths"; base: string } | { kind: "hash" };

export const VIEWS: readonly View[] = ["home", "about", "craft"];
const isView = (s: string): s is View => (VIEWS as readonly string[]).includes(s);

/** A route name is a view or an idea slug: "home", "about", "econsul" ... */
export function routeName(route: Route): string {
  return route.idea ?? route.view;
}

/** Name in → route out. Unknown names fall back to home. An idea keeps the view behind it. */
export function routeFromName(name: string, knownIdeas: readonly string[], viewBehind: View = "home"): Route {
  if (isView(name)) return { view: name };
  if (knownIdeas.includes(name)) return { view: viewBehind, idea: name };
  return { view: "home" };
}

export function nameFromLocation(loc: { pathname: string; hash: string }, mode: UrlMode): string {
  if (mode.kind === "hash") return loc.hash.slice(1) || "home";
  const p = loc.pathname.startsWith(mode.base) ? loc.pathname.slice(mode.base.length) : "";
  return p.replace(/index\.html$/, "").replace(/\/$/, "") || "home";
}

export function hrefFor(name: string, mode: UrlMode): string {
  if (mode.kind === "hash") return "#" + name;
  return mode.base + (name && name !== "home" ? name + "/" : "");
}

/** Old #links on the live site: where should they go instead? */
export function legacyHashTarget(hash: string, known: readonly string[]): string | null {
  const name = hash.slice(1);
  return hash.length > 1 && known.includes(name) ? name : null;
}
