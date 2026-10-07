/** Shared by the browser tests: a fake board and inbox (the test build points at board.test and inbox.test), and small helpers. */
import type { Page, Route } from "@playwright/test";
import { createHash } from "node:crypto";

/** Fake the outside world: the test build points at board.test and inbox.test (see build:test), and both are intercepted here. */
export type Row = { id: string; name: string; message: string; created_at: string; stage?: string; links?: { title: string; url: string }[]; categories?: string[] | null; kind?: "idea" | "dream" };
export type CommentRow = Row & { idea_id: string; parent_id?: string | null };
export type Board = { rows: Row[]; down?: boolean; posts: unknown[]; deletes: unknown[]; mails: number; comments?: CommentRow[]; commentsDown?: boolean; commentPostsDown?: boolean; mailBodies?: string[]; likes?: { idea_id: string; liker_hash: string }[]; likesDown?: boolean; commentLikes?: { comment_id: string; liker_hash: string }[]; stageMoves?: unknown[]; stageDown?: boolean; updates?: { id: string; idea_id: string; message: string; links: unknown; created_at: string }[]; updatesDown?: boolean; categorize?: string[]; categorizeDown?: boolean; categorizeCalls?: string[]; firstVisit?: boolean };
export async function fakeServices(page: Page, board: Board = { rows: [], posts: [], deletes: [], mails: 0 }) {
  // The first-visit hint plays over the sky for ~10 s; most tests are not first visits (tests/e2e/hint.spec.ts shows it).
  if (!board.firstVisit) await page.addInitScript(() => { try { localStorage.setItem("skyofideas.hint.cage", "1"); } catch { /* none */ } });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("https://board.test/**", async (r: Route) => {
    if (board.down) return r.fulfill({ status: 500, body: "down" });
    const url = r.request().url(), method = r.request().method();
    if (url.endsWith("/functions/v1/categorize")) { // the Edge Function that asks Jev
      const { id } = r.request().postDataJSON();
      (board.categorizeCalls ??= []).push(id);
      if (board.categorizeDown) return r.fulfill({ status: 502, json: { categories: null } });
      const categories = board.categorize ?? ["tech"], row = board.rows.find((x) => x.id === id);
      if (row) row.categories ??= categories;
      return r.fulfill({ json: { categories: row?.categories ?? categories } });
    }
    if (url.includes("/rest/v1/comment_likes") || url.includes("unlike_comment")) {
      board.commentLikes ??= [];
      if (method === "GET") { const ids = new URL(url).searchParams.get("comment_id")!.replace(/^in\.\(|\)$/g, "").split(","); return r.fulfill({ json: board.commentLikes.filter((l) => ids.includes(l.comment_id)).map((l) => ({ comment_id: l.comment_id })) }); }
      if (url.includes("unlike_comment")) {
        const { p_comment_id, p_liker } = r.request().postDataJSON(), hash = createHash("sha256").update(p_liker).digest("hex");
        board.commentLikes = board.commentLikes.filter((l) => !(l.comment_id === p_comment_id && l.liker_hash === hash));
        return r.fulfill({ json: true });
      }
      const b = r.request().postDataJSON();
      if (board.commentLikes.some((l) => l.comment_id === b.comment_id && l.liker_hash === b.liker_hash)) return r.fulfill({ status: 409, body: "" });
      board.commentLikes.push(b);
      return r.fulfill({ status: 201, body: "" });
    }
    if (url.includes("/rest/v1/comments") || url.includes("delete_comment")) {
      board.comments ??= [];
      if (board.commentsDown) return r.fulfill({ status: 500, body: "down" });
      if (method === "GET") { const id = new URL(url).searchParams.get("idea_id")!.slice(3); return r.fulfill({ json: board.comments.filter((x) => x.idea_id === id) }); }
      if (board.commentPostsDown) return r.fulfill({ status: 500, body: "down" });
      if (url.includes("delete_comment")) { const { p_id } = r.request().postDataJSON(); board.comments = board.comments.filter((x) => x.id !== p_id && x.parent_id !== p_id); return r.fulfill({ json: true }); } // replies go with their comment
      const b = r.request().postDataJSON();
      board.comments.push({ id: b.id, idea_id: b.idea_id, parent_id: b.parent_id ?? null, name: b.name, message: b.message, created_at: new Date().toISOString() });
      return r.fulfill({ status: 201, body: "" });
    }
    if (url.includes("/rest/v1/likes") || url.includes("unlike_idea")) {
      board.likes ??= [];
      if (board.likesDown) return r.fulfill({ status: 500, body: "down" });
      if (method === "HEAD") { const id = new URL(url).searchParams.get("idea_id")!.slice(3); return r.fulfill({ status: 200, headers: { "content-range": `*/${board.likes.filter((l) => l.idea_id === id).length}`, "access-control-expose-headers": "Content-Range", "access-control-allow-origin": "*" } }); }
      if (url.includes("unlike_idea")) {
        const { p_idea_id, p_liker } = r.request().postDataJSON(), hash = createHash("sha256").update(p_liker).digest("hex");
        board.likes = board.likes.filter((l) => !(l.idea_id === p_idea_id && l.liker_hash === hash));
        return r.fulfill({ json: true });
      }
      const b = r.request().postDataJSON();
      if (board.likes.some((l) => l.idea_id === b.idea_id && l.liker_hash === b.liker_hash)) return r.fulfill({ status: 409, body: "" });
      board.likes.push(b);
      return r.fulfill({ status: 201, body: "" });
    }
    if (url.includes("/rest/v1/idea_updates") || url.includes("idea_update")) {
      board.updates ??= [];
      if (board.updatesDown) return r.fulfill({ status: 500, body: "down" });
      if (method === "GET") { const id = new URL(url).searchParams.get("idea_id")!.slice(3); return r.fulfill({ json: board.updates.filter((x) => x.idea_id === id) }); }
      const b = r.request().postDataJSON(), hash = createHash("sha256").update(b.p_key).digest("hex");
      const ownerOf = (ideaId: string) => (board.posts as { id: string; delete_key_hash: string }[]).some((p) => p.id === ideaId && p.delete_key_hash === hash);
      if (url.endsWith("/rpc/add_idea_update")) {
        if (!ownerOf(b.p_idea_id)) return r.fulfill({ json: false });
        board.updates.push({ id: b.p_id, idea_id: b.p_idea_id, message: b.p_message, links: b.p_links, created_at: new Date().toISOString() });
        return r.fulfill({ json: true });
      }
      const u = board.updates.find((x) => x.id === b.p_id);
      if (!u || !ownerOf(u.idea_id)) return r.fulfill({ json: false });
      board.updates = board.updates.filter((x) => x.id !== b.p_id);
      return r.fulfill({ json: true });
    }
    if (method === "GET") { // ideas for the sky, dreams for the sea
      const kind = new URL(url).searchParams.get("kind");
      return r.fulfill({ json: board.rows.filter((x) => kind === "eq.dream" ? x.kind === "dream" : x.kind !== "dream") });
    }
    if (url.endsWith("/rest/v1/ideas")) {
      const body = r.request().postDataJSON();
      board.posts.push(body);
      board.rows.unshift({ id: body.id, name: body.name, message: body.message, links: body.links ?? [], stage: "idea", created_at: new Date().toISOString(), ...(body.kind ? { kind: body.kind } : {}) });
      return r.fulfill({ status: 201, body: "" });
    }
    if (url.endsWith("/rpc/set_idea_stage")) {
      if (board.stageDown) return r.fulfill({ status: 500, body: "down" });
      const b = r.request().postDataJSON(), row = board.rows.find((x) => x.id === b.p_id);
      (board.stageMoves ??= []).push(b);
      if (row) row.stage = b.p_stage;
      return r.fulfill({ json: !!row });
    }
    if (url.endsWith("/rpc/delete_idea")) { board.deletes.push(r.request().postDataJSON()); return r.fulfill({ json: true }); }
    return r.fulfill({ status: 404 });
  });
  await page.route("https://inbox.test/**", (r) => { board.mails++; (board.mailBodies ??= []).push(r.request().postData() ?? ""); return r.fulfill({ json: { ok: true } }); });
  return board;
}
/** Wait for opening animations (the note unfolding, a letter opening) to finish, as a person would before clicking inside. */
export async function settled(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity));
}

export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  return errors;
}

export const gioRow = { id: "zzzzzz1", name: "Gio", message: "Night markets", created_at: "2026-09-30T10:00:00Z" };
export const dreamRow = (id: string, message: string, categories: string[] | null, hoursAgo = 1): Row =>
  ({ id, name: "Anonymous", message, created_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(), kind: "dream", categories });
export const withGio = (): Board => ({ rows: [{ ...gioRow }], posts: [], deletes: [], mails: 0 });
