/** Comments under a visitor idea, inside its letter. The comments show at once; the form to write one opens from the comment icon.
 *  Thread: loading → ready | unavailable.  Form: closed → editing → sending → editing (added) | failed (text kept).
 *  Every open gets a token, so answers that arrive after the letter closed or switched are ignored. */
import { commentCountLabel, threadFor, validateCommentDraft, type Comment } from "../lib/comments";
import { newRecordId } from "../lib/ideas";
import type { CommentStore } from "../boundaries/commentStore";
import type { Inbox } from "../boundaries/inbox";
import { byId, randomBytes } from "./dom";

export type Thread = { open(ideaId: string): void; close(): void };

const LOADING = "Loading comments…";
const UNAVAILABLE = "Comments couldn’t load right now. Try again later.";
const SEND_FAILED = "Couldn’t post your comment. Try again in a moment.";
const REMOVE_FAILED = "Couldn’t remove it. Try again later.";

export function startThread(opts: {
  store: Promise<CommentStore>; inbox: Inbox; ideaNameOf: (ideaId: string) => string; now?: () => number;
  /** A comment was saved and shown. */
  posted?: (ideaId: string) => void;
}): Thread {
  const now = opts.now ?? Date.now;
  const list = byId<HTMLOListElement>("thread-list"), status = byId("thread-status"), count = byId("thread-count");
  const commentBtn = byId<HTMLButtonElement>("comment-btn"), iconCount = byId("comment-count");
  const form = byId<HTMLFormElement>("thread-form"), err = byId("comment-error"), send = form.querySelector<HTMLButtonElement>(".thread-send")!;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  let ideaId: string | null = null, token = 0, comments: Comment[] = [], store: CommentStore | null = null;
  let loaded = false, formWanted = false;
  const dateOf = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  function setStatus(text: string | null): void { status.hidden = !text; status.textContent = text ?? ""; }

  function render(freshId?: string): void {
    count.textContent = commentCountLabel(comments.length);
    iconCount.textContent = comments.length ? String(comments.length) : "";
    list.replaceChildren(...comments.map((c) => {
      const li = document.createElement("li");
      if (c.id === freshId) li.className = "fresh";
      const meta = document.createElement("p"); meta.className = "c-meta";
      const who = document.createElement("b"); who.textContent = c.name;
      meta.append(who, c.at ? " · " + dateOf(c.at) : "");
      const body = document.createElement("p"); body.className = "c-body"; body.textContent = c.message;
      li.append(meta, body);
      if (store?.canRemove(c)) {
        const rm = document.createElement("button");
        rm.type = "button"; rm.className = "c-remove"; rm.textContent = "Remove"; rm.dataset.comment = c.id;
        rm.setAttribute("aria-label", "Remove your comment");
        li.append(rm);
      }
      return li;
    }));
  }

  async function open(id: string): Promise<void> {
    const mine = ++token;
    ideaId = id; comments = []; loaded = false; formWanted = false;
    form.reset(); err.hidden = true; send.disabled = false; showForm();
    list.replaceChildren(); count.textContent = ""; iconCount.textContent = ""; commentBtn.disabled = false; setStatus(LOADING);
    store = await opts.store;
    const found = await store.list(id);
    if (mine !== token) return;
    if (!found) { setStatus(UNAVAILABLE); commentBtn.disabled = true; return; }
    comments = threadFor(found, id); loaded = true;
    setStatus(null); showForm(); render();
  }

  function showForm(): void {
    form.hidden = !(loaded && formWanted);
    commentBtn.setAttribute("aria-expanded", String(formWanted));
  }
  commentBtn.addEventListener("click", () => {
    formWanted = !formWanted;
    showForm();
    if (!form.hidden) field("message").focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ideaId || !store) return;
    const check = validateCommentDraft({ name: field("name").value, message: field("message").value, trap: field("_gotcha").value });
    if (!check.ok) {
      if (check.reason === "bot") { form.reset(); return; }
      err.textContent = check.text; err.hidden = false; field("message").focus(); return;
    }
    err.hidden = true;
    const mine = token, forIdea = ideaId;
    const c: Comment = { id: newRecordId(randomBytes(8)), ideaId: forIdea, ...check.comment, at: now() };
    send.disabled = true;
    const saved = await store.add(c);
    if (mine !== token) return;
    send.disabled = false;
    if (!saved) { err.textContent = SEND_FAILED; err.hidden = false; return; }
    opts.inbox.sendComment(c, opts.ideaNameOf(forIdea), location.href);
    comments = threadFor([...comments, c], forIdea);
    field("message").value = "";
    render(c.id);
    opts.posted?.(forIdea);
  });

  list.addEventListener("click", async (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>(".c-remove");
    const c = b && comments.find((x) => x.id === b.dataset.comment);
    if (!b || !c || !store) return;
    const mine = token;
    b.disabled = true;
    const ok = await store.remove(c);
    if (mine !== token) return;
    if (!ok) { b.disabled = false; b.textContent = REMOVE_FAILED; return; }
    comments = comments.filter((x) => x.id !== c.id);
    render();
  });

  return {
    open: (id) => { void open(id); },
    close: () => { token++; ideaId = null; },
  };
}
