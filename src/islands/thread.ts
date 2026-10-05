/** Comments under a visitor idea, inside its letter. The comments show at once; the form to write one opens from the comment icon,
 *  or from Reply on a comment (then it says who it answers). Replies show under their comment, one level deep. Each comment has a heart.
 *  Thread: loading → ready | unavailable.  Form: closed → editing (maybe replying) → sending → editing (added) | failed (text kept).
 *  Every open gets a token, so answers that arrive after the letter closed or switched are ignored. */
import { commentGroups, replyParent, threadFor, validateCommentDraft, type Comment } from "../lib/comments";
import type { CommentLikeStore } from "../boundaries/commentLikeStore";
import { newRecordId } from "../lib/ideas";
import type { CommentStore } from "../boundaries/commentStore";
import type { Inbox } from "../boundaries/inbox";
import { byId, hideOnEdit, randomBytes } from "./dom";

export type Thread = { open(ideaId: string): void; close(): void; /** Hide the comment form (another icon was chosen); what was typed stays. */ closePanel(): void };

const LOADING = "Loading comments…";
const UNAVAILABLE = "Comments couldn’t load right now. Try again later.";
const SEND_FAILED = "Couldn’t post your comment. Try again in a moment.";
const REMOVE_FAILED = "Couldn’t remove it. Try again later.";

export function startThread(opts: {
  store: Promise<CommentStore>; likes: Promise<CommentLikeStore>; inbox: Inbox; ideaNameOf: (ideaId: string) => string; now?: () => number;
  /** A comment was saved and shown. */
  posted?: (ideaId: string) => void;
  /** The comment form was just opened by its icon. */
  opened?: () => void;
}): Thread {
  const now = opts.now ?? Date.now;
  const list = byId<HTMLOListElement>("thread-list"), status = byId("thread-status");
  const commentBtn = byId<HTMLButtonElement>("comment-btn"), iconCount = byId("comment-count");
  const form = byId<HTMLFormElement>("thread-form"), err = byId("comment-error"), send = form.querySelector<HTMLButtonElement>(".thread-send")!;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  let ideaId: string | null = null, token = 0, comments: Comment[] = [], store: CommentStore | null = null;
  let loaded = false, formWanted = false, replyTo: Comment | null = null, likeCounts = new Map<string, number>(), likes: CommentLikeStore | null = null;
  const replyChip = byId("reply-to"), replyName = replyChip.querySelector<HTMLElement>(".reply-to-name")!;
  const dateOf = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  function setStatus(text: string | null): void { status.hidden = !text; status.textContent = text ?? ""; }

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.4-4.5-9.2-9C1.5 8 3.6 4.6 7 4.6c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.4 0 5.5 3.4 4.2 6.7-1.8 4.5-9.2 9-9.2 9z"/></svg>';
  function button(cls: string, id: string, text: string, label: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button"; b.className = cls; b.dataset.comment = id; b.textContent = text; b.setAttribute("aria-label", label);
    return b;
  }
  function itemFor(c: Comment, freshId?: string): HTMLLIElement {
    const li = document.createElement("li");
    if (c.id === freshId) li.className = "fresh";
    const meta = document.createElement("p"); meta.className = "c-meta";
    const who = document.createElement("b"); who.textContent = c.name;
    meta.append(who, c.at ? " · " + dateOf(c.at) : "");
    const body = document.createElement("p"); body.className = "c-body"; body.textContent = c.message;
    const actions = document.createElement("div"); actions.className = "c-actions";
    const liked = likes?.likedHere(c.id) ?? false, count = likeCounts.get(c.id) ?? 0;
    const heart = button("c-like", c.id, "", liked ? "Unlike this comment" : "Like this comment");
    heart.setAttribute("aria-pressed", String(liked));
    heart.innerHTML = HEART + `<span class="c-like-count">${count || ""}</span>`;
    actions.append(button("c-reply", c.id, "Reply", `Reply to ${c.name}`), heart);
    if (store?.canRemove(c)) actions.append(button("c-remove", c.id, "Remove", "Remove your comment"));
    li.append(meta, body, actions);
    return li;
  }
  function render(freshId?: string): void {
    iconCount.textContent = comments.length ? String(comments.length) : "";
    list.replaceChildren(...commentGroups(comments, ideaId ?? "").map(({ comment, replies }) => {
      const li = itemFor(comment, freshId);
      if (replies.length) {
        const ol = document.createElement("ol"); ol.className = "replies";
        ol.append(...replies.map((r) => itemFor(r, freshId)));
        li.append(ol);
      }
      return li;
    }));
  }

  function setReply(target: Comment | null): void {
    replyTo = target;
    replyChip.hidden = !target;
    replyName.textContent = target ? `Replying to ${target.name}` : "";
  }

  async function open(id: string): Promise<void> {
    const mine = ++token;
    ideaId = id; comments = []; loaded = false; formWanted = false; likeCounts = new Map(); setReply(null);
    form.reset(); err.hidden = true; send.disabled = false; showForm();
    list.replaceChildren(); iconCount.textContent = ""; commentBtn.disabled = false; setStatus(LOADING);
    store = await opts.store;
    const found = await store.list(id);
    if (mine !== token) return;
    if (!found) { setStatus(UNAVAILABLE); commentBtn.disabled = true; return; }
    comments = threadFor(found, id); loaded = true;
    setStatus(null); showForm(); render();
    likes = await opts.likes;
    const counts = await likes.counts(comments.map((c) => c.id));
    if (mine !== token) return;
    if (counts) { likeCounts = counts; render(); } // no counts: the hearts still work, from zero
  }

  function showForm(): void {
    form.hidden = !(loaded && formWanted);
    commentBtn.setAttribute("aria-expanded", String(formWanted));
  }
  commentBtn.addEventListener("click", () => {
    formWanted = !formWanted;
    if (!formWanted) setReply(null);
    showForm();
    if (formWanted) opts.opened?.();
    if (!form.hidden) field("message").focus();
  });

  hideOnEdit(form, err);
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
    const c: Comment = { id: newRecordId(randomBytes(8)), ideaId: forIdea, parentId: replyTo ? replyParent(replyTo) : null, ...check.comment, at: now() };
    send.disabled = true;
    const saved = await store.add(c);
    if (mine !== token) return;
    send.disabled = false;
    if (!saved) { err.textContent = SEND_FAILED; err.hidden = false; return; }
    opts.inbox.sendComment(c, opts.ideaNameOf(forIdea), location.href);
    comments = threadFor([...comments, c], forIdea);
    field("message").value = "";
    setReply(null);
    render(c.id);
    opts.posted?.(forIdea);
  });

  replyChip.querySelector(".reply-cancel")!.addEventListener("click", () => { setReply(null); field("message").focus(); });

  list.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>(".c-reply");
    const c = b && comments.find((x) => x.id === b.dataset.comment);
    if (!c) return;
    setReply(c);
    formWanted = true; showForm(); opts.opened?.();
    field("message").focus();
  });

  /** A heart: shown liked at once, and set back if saving it fails. */
  list.addEventListener("click", async (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>(".c-like");
    const id = b?.dataset.comment;
    if (!b || !id || !likes) return;
    const mine = token, wasLiked = likes.likedHere(id), before = likeCounts.get(id) ?? 0;
    const setCount = (n: number) => { if (n > 0) likeCounts.set(id, n); else likeCounts.delete(id); };
    setCount(before + (wasLiked ? -1 : 1));
    const saving = wasLiked ? likes.unlike(id) : likes.like(id); // the store marks it liked (or not) right away
    render();
    const ok = await saving;
    if (mine !== token) return;
    if (!ok) { setCount(before); render(); }
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
    comments = comments.filter((x) => x.id !== c.id && x.parentId !== c.id); // its replies go with it
    render();
  });

  return {
    open: (id) => { void open(id); },
    close: () => { token++; ideaId = null; },
    closePanel: () => { formWanted = false; showForm(); },
  };
}
