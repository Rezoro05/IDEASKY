/** Shared by the browser tests: a fake board and inbox (the test build points at board.test and inbox.test), and small helpers. */
import type { Page, Route } from "@playwright/test";
import { createHash } from "node:crypto";

/** Fake the outside world: the test build points at board.test and inbox.test (see build:test), and both are intercepted here. */
export type Row = { id: string; name: string; message: string; created_at: string; stage?: string; links?: { title: string; url: string }[] };
export type CommentRow = Row & { idea_id: string };
export type Board = { rows: Row[]; down?: boolean; posts: unknown[]; deletes: unknown[]; mails: number; comments?: CommentRow[]; commentsDown?: boolean; commentPostsDown?: boolean; mailBodies?: string[]; likes?: { idea_id: string; liker_hash: string }[]; likesDown?: boolean; stageMoves?: unknown[]; stageDown?: boolean; updates?: { id: string; idea_id: string; message: string; links: unknown; created_at: string }[]; updatesDown?: boolean };
export async function fakeServices(page: Page, board: Board = { rows: [], posts: [], deletes: [], mails: 0 }) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("https://board.test/**", async (r: Route) => {
    if (board.down) return r.fulfill({ status: 500, body: "down" });
    const url = r.request().url(), method = r.request().method();
    if (url.includes("/rest/v1/comments") || url.includes("delete_comment")) {
      board.comments ??= [];
      if (board.commentsDown) return r.fulfill({ status: 500, body: "down" });
      if (method === "GET") { const id = new URL(url).searchParams.get("idea_id")!.slice(3); return r.fulfill({ json: board.comments.filter((x) => x.idea_id === id) }); }
      if (board.commentPostsDown) return r.fulfill({ status: 500, body: "down" });
      if (url.includes("delete_comment")) { const { p_id } = r.request().postDataJSON(); board.comments = board.comments.filter((x) => x.id !== p_id); return r.fulfill({ json: true }); }
      const b = r.request().postDataJSON();
      board.comments.push({ id: b.id, idea_id: b.idea_id, name: b.name, message: b.message, created_at: new Date().toISOString() });
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
    if (method === "GET") return r.fulfill({ json: board.rows });
    if (url.endsWith("/rest/v1/ideas")) {
      const body = r.request().postDataJSON();
      board.posts.push(body);
      board.rows.unshift({ id: body.id, name: body.name, message: body.message, links: body.links ?? [], stage: "idea", created_at: new Date().toISOString() });
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
export const withGio = (): Board => ({ rows: [{ ...gioRow }], posts: [], deletes: [], mails: 0 });
