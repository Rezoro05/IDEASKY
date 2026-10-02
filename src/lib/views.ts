/** Pure: content → markup strings. Used at build time (pages ship with real HTML) and at run time (the same markup when a panel opens). */
import type { Idea, Fact } from "../content/ideas";
import type { Stop } from "../content/stops";

export const esc = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const planeNumber = (index: number): string => String(index + 1).padStart(2, "0");
export const planeTag = (idea: Idea, index: number): string => `${planeNumber(index)} · ${idea.title}`;
export const planeLabel = (idea: Idea, index: number): string => `${planeTag(idea, index)}: open the idea`;

export const ideaEyebrow = (idea: Idea): string => (idea.year && idea.year !== "—" ? `Idea · ${idea.year}` : "Idea");
export const ideaLinkText = (idea: Idea): string => `Visit ${idea.urlLabel ?? ""} ↗`;

export function factsHtml(facts: readonly Fact[]): string {
  return facts.map(([k, val]) => typeof val === "string"
    ? `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`
    : `<div class="span-all"><dt>${esc(k)}</dt><dd><ul>${val.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></dd></div>`).join("");
}

const size = (w?: number, h?: number): string => (w && h ? ` width="${w}" height="${h}"` : "");

export function ideaMediaHtml(idea: Idea): string {
  return (idea.media ?? []).map((m) =>
    `<figure><img src="${esc(m.src)}"${size(m.w, m.h)} alt="${esc(m.alt)}" loading="lazy"><figcaption>${esc(m.caption)}</figcaption></figure>`).join("");
}

export function ideaListHtml(ideas: readonly Idea[], hrefFor: (slug: string) => string): string {
  return ideas.map((i) =>
    `<li><a href="${esc(hrefFor(i.slug))}" data-slug="${esc(i.slug)}"><span class="name">${esc(i.title)}</span><span class="line">${esc(i.line)}</span><span class="year">${esc(i.year)}</span></a></li>`).join("");
}

export function stopPanelHtml(st: Stop): string {
  const awards = st.awards
    ? `<p class="s-awards-h">Recognition</p><ul class="s-awards">${st.awards.map(([m, what, yr]) => `<li><span class="medal">${esc(m)}</span><span>${esc(what)}</span><span class="when">${esc(yr)}</span></li>`).join("")}</ul>`
    : "";
  const links = st.links
    ? `<div class="s-links">${st.links.map(([t, label]) => `<button class="panel-link" type="button" data-target="${esc(t)}">${esc(label)}</button>`).join("")}</div>`
    : "";
  const photo = st.photo
    ? `<figure><img src="${esc(st.photo.src)}"${size(st.photo.w, st.photo.h)} alt="${esc(st.photo.alt)}" loading="lazy"><figcaption>${esc(st.photo.caption)}</figcaption></figure>`
    : "";
  const text = st.text ? `<p>${esc(st.text)}</p>` : "";
  const bullets = st.bullets ? `<ul>${st.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
  return `<div><h3>${esc(st.title)} <span class="s-role">· ${esc(st.when)}</span></h3><p class="s-role">${esc(st.role)}</p>${text}${bullets}${awards}${links}</div>${photo}`;
}
