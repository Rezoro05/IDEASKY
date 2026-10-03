/** An owner's updates on an open idea: everyone reads them, oldest first; the owner adds one with "+ Add update" and can remove any.
 *  List: loading → ready | unavailable.  Form: closed → editing → sending → closed (added) | editing with an error (text kept).
 *  Every open gets a token, so answers that arrive after the letter closed or switched are ignored. */
import { newRecordId } from "../lib/ideas";
import { updateCountLabel, updatesFor, validateUpdateDraft, type Update } from "../lib/updates";
import type { UpdateStore } from "../boundaries/updateStore";
import { byId, randomBytes } from "./dom";
import { linkRowsIn } from "./link-rows";
import { linkItems } from "./link-list";

export type Updates = { open(ideaId: string): void; close(): void; /** Hide the update form (another icon was chosen); what was typed stays. */ closePanel(): void };

const UNAVAILABLE = "Updates couldn’t load right now.";
const SEND_FAILED = "Couldn’t post your update. Try again in a moment.";
const REMOVE_FAILED = "Couldn’t remove it. Try again later.";

export function startUpdates(opts: { store: Promise<UpdateStore>; now?: () => number; /** The update form was just opened by its icon. */ opened?: () => void }): Updates {
  const now = opts.now ?? Date.now;
  const section = byId("updates"), list = byId<HTMLOListElement>("updates-list"), count = byId("updates-count"), status = byId("updates-status");
  const addButton = byId<HTMLButtonElement>("add-update"), form = byId<HTMLFormElement>("update-form"), message = byId<HTMLTextAreaElement>("update-msg");
  const err = byId("update-error"), send = form.querySelector<HTMLButtonElement>(".update-send")!, links = linkRowsIn(byId("update-link-rows"));
  let ideaId: string | null = null, token = 0, updates: Update[] = [], owner = false, store: UpdateStore | null = null;
  const dateOf = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  function setStatus(text: string | null): void { status.hidden = !text; status.textContent = text ?? ""; }

  /** The section shows only when there is something in it: updates, the form, or a status line. "+ Add update" sits in the owner row. */
  function showSectionIfUsed(): void { section.hidden = updates.length === 0 && form.hidden && status.hidden; }

  /** Hide the form but keep what was typed. The + stays visible; it shows as selected while the form is open. */
  function hideForm(): void {
    form.hidden = true; addButton.setAttribute("aria-expanded", "false");
    showSectionIfUsed();
  }
  function closeForm(): void {
    form.reset(); links.clear(); err.hidden = true;
    addButton.hidden = !owner;
    hideForm();
  }

  function render(freshId?: string): void {
    showSectionIfUsed();
    count.textContent = updates.length ? updateCountLabel(updates.length) : "";
    list.replaceChildren(...updates.map((u) => {
      const li = document.createElement("li");
      if (u.id === freshId) li.className = "fresh";
      const meta = document.createElement("p"); meta.className = "c-meta"; meta.textContent = u.at ? "Update · " + dateOf(u.at) : "Update";
      const body = document.createElement("p"); body.className = "c-body"; body.textContent = u.message;
      li.append(meta, body);
      if (u.links.length) {
        const ul = document.createElement("ul"); ul.className = "letter-links";
        ul.append(...linkItems(u.links));
        li.append(ul);
      }
      if (owner) {
        const rm = document.createElement("button");
        rm.type = "button"; rm.className = "c-remove"; rm.textContent = "Remove"; rm.dataset.update = u.id;
        rm.setAttribute("aria-label", "Remove this update");
        li.append(rm);
      }
      return li;
    }));
  }

  async function open(id: string): Promise<void> {
    const mine = ++token;
    ideaId = id; updates = []; owner = false;
    list.replaceChildren(); setStatus(null); closeForm();
    store = await opts.store;
    if (mine !== token) return;
    owner = store.canManage(id);
    const found = await store.list(id);
    if (mine !== token) return;
    if (!found) { setStatus(UNAVAILABLE); addButton.hidden = true; showSectionIfUsed(); return; }
    updates = updatesFor(found, id);
    closeForm(); render();
  }

  addButton.addEventListener("click", () => {
    if (!form.hidden) { hideForm(); return; }
    form.hidden = false; addButton.setAttribute("aria-expanded", "true"); showSectionIfUsed(); opts.opened?.(); message.focus();
  });
  byId("update-cancel").addEventListener("click", () => { closeForm(); addButton.focus(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ideaId || !store) return;
    const check = validateUpdateDraft({ message: message.value, linkRows: links.typed() });
    if (!check.ok) {
      err.textContent = check.text; err.hidden = false;
      if (check.reason === "bad-link") links.focusRow(check.row); else message.focus();
      return;
    }
    err.hidden = true;
    const mine = token, forIdea = ideaId;
    const update: Update = { id: newRecordId(randomBytes(8)), ideaId: forIdea, ...check.update, at: now() };
    send.disabled = true;
    const saved = await store.add(update);
    send.disabled = false;
    if (mine !== token) return;
    if (!saved) { err.textContent = SEND_FAILED; err.hidden = false; return; }
    updates = updatesFor([...updates, update], forIdea);
    closeForm(); render(update.id); addButton.focus();
  });

  list.addEventListener("click", async (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>(".c-remove");
    const u = b && updates.find((x) => x.id === b.dataset.update);
    if (!b || !u || !store) return;
    const mine = token;
    b.disabled = true;
    const ok = await store.remove(u);
    if (mine !== token) return;
    if (!ok) { b.disabled = false; b.textContent = REMOVE_FAILED; return; }
    updates = updates.filter((x) => x.id !== u.id);
    render();
  });

  return {
    open: (id) => { void open(id); },
    close: () => { token++; ideaId = null; },
    closePanel: hideForm,
  };
}
