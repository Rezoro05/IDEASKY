/** Browse every idea (from the sky) or dream (from the sea), not just the few flying or swimming: newest first, one category at a time
 *  if you like, older ones on request. Choosing one opens its letter, as catching it would. Works the same in your own sky and sea.
 *  States: closed → open (list) ⇄ loading older → open | open with an error. */
import { browseList, categoriesIn } from "../lib/browse";
import { LISTS, categoryLabel } from "../lib/categories";
import { previewLine, type Idea } from "../lib/ideas";
import { stageLabel } from "../lib/stages";
import { v, type Vec } from "../lib/vec";
import { byId, cancelPendingOpen, openWithTransition } from "./dom";

/** What the sky's board and the sea offer for browsing. */
export type Browsable = { records(): Idea[]; nameOf(id: string): string; loadOlder(): Promise<"more" | "end" | "failed">; mayHaveOlder(): boolean };
type Kind = "idea" | "dream";

const SAYS = {
  title: { idea: "All ideas", dream: "All dreams" },
  empty: { idea: "No ideas yet.", dream: "No dreams yet." },
  emptyHere: "None in this category yet.",
  failed: "Couldn’t load older ones just now. Try again in a moment.",
  loading: "Loading…",
  more: "Show older",
};
const dateOf = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function startBrowse(opts: {
  ideas: Browsable; dreams: Browsable;
  /** Open one's letter, unfolding from `origin` (screen point). */
  open: (id: string, origin: Vec) => void;
  stagesShown: () => boolean;
  /** Your own sky and sea: the label is already your own name for it, so no author is shown. */
  isPrivate: () => boolean;
}): { close(): void } {
  const overlay = byId("browse"), list = byId<HTMLUListElement>("browse-list"), chips = byId("browse-chips");
  const empty = byId("browse-empty"), more = byId<HTMLButtonElement>("browse-more"), error = byId("browse-error");
  let kind: Kind = "idea", category: string | null = null, opener: HTMLElement | null = null, token = 0;
  const from = () => (kind === "idea" ? opts.ideas : opts.dreams);

  function render(): void {
    const records = from().records(), present = categoriesIn(records, LISTS[kind]);
    if (category && !present.some((c) => c.key === category)) category = null;
    byId("browse-title").textContent = SAYS.title[kind];
    chips.hidden = present.length === 0;
    chips.replaceChildren(...[{ key: "", label: "All" }, ...present].map((c) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "browse-chip"; b.dataset.category = c.key; b.textContent = c.label;
      b.setAttribute("aria-pressed", String((category ?? "") === c.key));
      return b;
    }));
    const shown = browseList(records, category);
    list.replaceChildren(...shown.map((n) => {
      const li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.className = "browse-item"; b.dataset.id = n.id;
      const name = document.createElement("span"); name.className = "b-name"; name.textContent = from().nameOf(n.id);
      const line = document.createElement("span"); line.className = "b-line"; line.textContent = previewLine(n.message);
      const meta = document.createElement("span"); meta.className = "b-meta";
      const tags = (n.categories ?? []).map((k) => categoryLabel(LISTS[kind], k));
      const stage = kind === "idea" && opts.stagesShown() && n.stage !== "idea" ? [stageLabel(n.stage)] : [];
      meta.textContent = [...(opts.isPrivate() ? [] : [n.name]), dateOf(n.at), ...stage, ...tags].join(" · ");
      b.append(name, line, meta); li.append(b); return li;
    }));
    empty.hidden = shown.length > 0;
    empty.textContent = records.length === 0 ? SAYS.empty[kind] : SAYS.emptyHere;
    more.hidden = !from().mayHaveOlder();
  }

  function openAs(next: Kind, button: HTMLElement): void {
    kind = next; category = null; opener = button; error.hidden = true; more.disabled = false; more.textContent = SAYS.more;
    render();
    openWithTransition(overlay);
    (chips.querySelector<HTMLButtonElement>("button") ?? byId<HTMLButtonElement>("browse-close")).focus({ preventScroll: true });
  }
  function close(returnFocus: boolean): void {
    token++;
    cancelPendingOpen(overlay);
    overlay.classList.remove("open"); overlay.hidden = true;
    if (returnFocus) opener?.focus({ preventScroll: true });
  }

  byId("browse-ideas").addEventListener("click", (e) => openAs("idea", e.currentTarget as HTMLElement));
  byId("browse-dreams").addEventListener("click", (e) => openAs("dream", e.currentTarget as HTMLElement));
  byId("browse-close").addEventListener("click", () => close(true));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(true); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(true); });
  chips.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button[data-category]");
    if (!b) return;
    category = b.dataset.category || null;
    render();
    chips.querySelector<HTMLButtonElement>(`button[data-category="${b.dataset.category}"]`)?.focus({ preventScroll: true });
  });
  list.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button[data-id]");
    if (!b) return;
    const r = b.getBoundingClientRect(), id = b.dataset.id!;
    close(false);
    opts.open(id, v(r.left + r.width / 2, r.top + r.height / 2));
  });
  more.addEventListener("click", async () => {
    const mine = ++token, before = list.children.length;
    more.disabled = true; more.textContent = SAYS.loading; error.hidden = true;
    const result = await from().loadOlder();
    if (mine !== token) return;
    more.disabled = false; more.textContent = SAYS.more;
    if (result === "failed") { error.textContent = SAYS.failed; error.hidden = false; return; }
    render();
    list.querySelectorAll<HTMLButtonElement>("button[data-id]")[before]?.focus({ preventScroll: true }); // on to the first older one
  });
  return { close: () => close(false) };
}
