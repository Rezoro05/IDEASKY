/** Shared by the browser tests: a fake board (the test build points at board.test), and small helpers. */
import type { Page, Route } from "@playwright/test";
import { createHash } from "node:crypto";

/** Fake the outside world: the test build points at board.test (see build:test), intercepted here. */
export type Row = { id: string; name: string; message: string; created_at: string; stage?: string; links?: { title: string; url: string }[]; categories?: string[] | null; kind?: "idea" | "dream" };
export type CommentRow = Row & { idea_id: string; parent_id?: string | null };
export type Board = { rows: Row[]; down?: boolean; posts: unknown[]; deletes: unknown[]; comments?: CommentRow[]; commentsDown?: boolean; commentPostsDown?: boolean; likes?: { idea_id: string; liker_hash: string }[]; likesDown?: boolean; commentLikes?: { comment_id: string; liker_hash: string }[]; stageMoves?: unknown[]; stageDown?: boolean; updates?: { id: string; idea_id: string; message: string; links: unknown; created_at: string }[]; updatesDown?: boolean; categorize?: string[]; categorizeDown?: boolean; categorizeCalls?: string[]; firstVisit?: boolean; signInLinks?: { email: string; redirect: string }[]; signInStatus?: number; signOuts?: number; google?: boolean; googleTrips?: string[]; privateItems?: PrivateRow[]; /** Public posts that belong to an account: id → user id. */ owners?: Record<string, string>; claims?: { id: string; key: string }[][]; likeCountsCalls?: number; privateRequests?: { method: string; owner: string | null }[]; privateUpdates?: { id: string; item_id: string; owner: string; message: string; links: unknown[]; created_at: string }[] };
/** A row of the private table as the database keeps it: the owner is whoever was signed in when it was added. */
export type PrivateRow = { id: string; owner: string; kind: "idea" | "dream"; name: string; message: string; links: unknown[]; stage: string; categories: string[] | null; created_at: string; public_id?: string | null };
export async function fakeServices(page: Page, board: Board = { rows: [], posts: [], deletes: [] }) {
  // The first-visit hint plays over the sky for ~10 s; most tests are not first visits (tests/e2e/hint.spec.ts shows it).
  if (!board.firstVisit) await page.addInitScript(() => { try { localStorage.setItem("skyofideas.hint.cage", "1"); } catch { /* none */ } });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("https://board.test/**", async (r: Route) => {
    if (board.down) return r.fulfill({ status: 500, body: "down" });
    const url = r.request().url(), method = r.request().method();
    if (url.includes("/rest/v1/private_items")) { // as the database's owner-only rules: each signed-in person sees and changes only their own rows
      const bearer = r.request().headers()["authorization"] ?? "", owner = ownerOf(bearer);
      (board.privateRequests ??= []).push({ method, owner });
      if (!owner) return r.fulfill({ status: 401, json: { message: "JWT required" } });
      const items = (board.privateItems ??= []), id = new URL(url).searchParams.get("id")?.replace(/^eq\./, "");
      if (method === "GET" || method === "HEAD") { // HEAD: how many there are (Content-Range), for browsing
        const q = new URL(url).searchParams, kind = q.get("kind")?.replace(/^eq\./, ""), before = q.get("created_at")?.replace(/^lt\./, "");
        const mine = items.filter((x) => x.owner === owner && (!kind || x.kind === kind) && (!before || Date.parse(x.created_at) < Date.parse(before))).sort((a, b) => b.created_at.localeCompare(a.created_at));
        if (method === "HEAD") return r.fulfill({ status: 200, headers: { "content-range": `*/${mine.length}`, "access-control-expose-headers": "Content-Range", "access-control-allow-origin": "*" }, body: "" });
        return r.fulfill({ json: mine });
      }
      if (method === "POST") {
        const b = r.request().postDataJSON();
        items.push({ id: b.id, owner, kind: b.kind ?? "idea", name: b.name ?? "", message: b.message, links: b.links ?? [], stage: "idea", categories: null, created_at: new Date().toISOString() });
        return r.fulfill({ status: 201, body: "" });
      }
      if (method === "DELETE") {
        const gone = items.filter((x) => x.id === id && x.owner === owner);
        board.privateItems = items.filter((x) => !(x.id === id && x.owner === owner));
        return r.fulfill({ json: gone });
      }
      if (method === "PATCH") {
        const row = items.find((x) => x.id === id && x.owner === owner);
        if (row) Object.assign(row, r.request().postDataJSON());
        return r.fulfill({ json: row ? [row] : [] });
      }
      return r.fulfill({ status: 405, body: "" });
    }
    if (url.includes("/rest/v1/private_updates")) { // your own ideas' updates: owner-only, as the database
      const owner = ownerOf(r.request().headers()["authorization"] ?? "");
      if (!owner) return r.fulfill({ status: 401, json: { message: "JWT required" } });
      const ups = (board.privateUpdates ??= []), q = new URL(url).searchParams;
      if (method === "GET") { const item = q.get("item_id")?.replace(/^eq\./, ""); return r.fulfill({ json: ups.filter((u) => u.owner === owner && u.item_id === item) }); }
      if (method === "POST") {
        const b = r.request().postDataJSON();
        if (!board.privateItems?.some((x) => x.id === b.item_id && x.owner === owner)) return r.fulfill({ status: 403, json: { message: "not yours" } });
        ups.push({ ...b, owner, created_at: new Date().toISOString() });
        return r.fulfill({ status: 201, body: "" });
      }
      if (method === "DELETE") { const id = q.get("id")?.replace(/^eq\./, ""); const gone = ups.filter((u) => u.id === id && u.owner === owner); board.privateUpdates = ups.filter((u) => !(u.id === id && u.owner === owner)); return r.fulfill({ json: gone }); }
      return r.fulfill({ status: 405, body: "" });
    }
    if (url.includes("/auth/v1/")) { // Supabase Auth: the magic link is "sent" (recorded), sign-out is counted
      if (url.includes("/auth/v1/otp")) {
        if (board.signInStatus && board.signInStatus !== 200) return r.fulfill({ status: board.signInStatus, body: "{}" });
        (board.signInLinks ??= []).push({ email: r.request().postDataJSON().email, redirect: new URL(url).searchParams.get("redirect_to") ?? "" });
        return r.fulfill({ json: {} });
      }
      if (url.includes("/auth/v1/settings")) return r.fulfill({ json: { external: { email: true, google: board.google === true } } });
      if (url.includes("/auth/v1/authorize")) { // the trip to Google and back, in one step: straight back to redirect_to, signed in
        const back = new URL(url).searchParams.get("redirect_to") ?? "";
        (board.googleTrips ??= []).push(back);
        return r.fulfill({ status: 302, headers: { location: back + signInReturn("rez@gmail.com", "google-user") } });
      }
      if (url.includes("/auth/v1/logout")) { board.signOuts = (board.signOuts ?? 0) + 1; return r.fulfill({ status: 204, body: "" }); }
      return r.fulfill({ status: 400, json: { error: "unexpected in tests" } });
    }
    if (url.endsWith("/functions/v1/categorize")) { // the Edge Function that asks Jev
      const { id, private: isPrivate } = r.request().postDataJSON();
      if (isPrivate) { // a private item: read and saved as its signed-in owner
        const owner = ownerOf(r.request().headers()["authorization"] ?? ""), row = board.privateItems?.find((x) => x.id === id && x.owner === owner);
        (board.categorizeCalls ??= []).push(`private:${id}`);
        if (!row) return r.fulfill({ status: 404, json: { categories: null } });
        if (!row.categories || row.categories.length === 0) row.categories = board.categorize ?? ["tech"];
        return r.fulfill({ json: { categories: row.categories } });
      }
      (board.categorizeCalls ??= []).push(id);
      if (board.categorizeDown) return r.fulfill({ status: 502, json: { categories: null } });
      const categories = board.categorize ?? ["tech"], row = board.rows.find((x) => x.id === id);
      if (row && (!row.categories || row.categories.length === 0)) row.categories = categories; // as the function: [] (old rule) is sorted again
      return r.fulfill({ json: { categories: row?.categories ?? categories } });
    }
    if (url.endsWith("/rpc/like_counts")) { // likes on many ideas at once (a liked one flies a little bigger)
      board.likes ??= []; board.likeCountsCalls = (board.likeCountsCalls ?? 0) + 1;
      const ids: string[] = r.request().postDataJSON().p_ids, counts = new Map<string, number>();
      for (const l of board.likes) if (ids.includes(l.idea_id)) counts.set(l.idea_id, (counts.get(l.idea_id) ?? 0) + 1);
      return r.fulfill({ json: [...counts].map(([idea_id, likes]) => ({ idea_id, likes })) });
    }
    if (url.includes("comment_like_counts")) { // the database counts (supabase/migrations/20261001000012_indexes_and_counts.sql)
      board.commentLikes ??= [];
      const ids: string[] = r.request().postDataJSON().p_ids, counts = new Map<string, number>();
      for (const l of board.commentLikes) if (ids.includes(l.comment_id)) counts.set(l.comment_id, (counts.get(l.comment_id) ?? 0) + 1);
      return r.fulfill({ json: [...counts].map(([comment_id, likes]) => ({ comment_id, likes })) });
    }
    if (url.includes("/rest/v1/comment_likes") || url.includes("unlike_comment")) {
      board.commentLikes ??= [];
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
      const b = r.request().postDataJSON(), hash = b.p_key ? createHash("sha256").update(b.p_key).digest("hex") : "", me = ownerOf(r.request().headers()["authorization"] ?? "");
      const owns = (ideaId: string) => (board.posts as { id: string; delete_key_hash: string }[]).some((p) => p.id === ideaId && p.delete_key_hash === hash) || (!!me && board.owners?.[ideaId] === me);
      if (url.endsWith("/rpc/add_idea_update")) {
        if (!owns(b.p_idea_id)) return r.fulfill({ json: false });
        board.updates.push({ id: b.p_id, idea_id: b.p_idea_id, message: b.p_message, links: b.p_links, created_at: new Date().toISOString() });
        return r.fulfill({ json: true });
      }
      const u = board.updates.find((x) => x.id === b.p_id);
      if (!u || !owns(u.idea_id)) return r.fulfill({ json: false });
      board.updates = board.updates.filter((x) => x.id !== b.p_id);
      return r.fulfill({ json: true });
    }
    if (url.endsWith("/rpc/my_idea_ids")) { // your own public posts, as the database answers it (ids only)
      const me = ownerOf(r.request().headers()["authorization"] ?? "");
      return r.fulfill({ json: me ? Object.entries(board.owners ?? {}).filter(([, o]) => o === me).map(([id]) => id) : [] });
    }
    if (url.endsWith("/rpc/claim_ideas")) { // this browser's earlier posts join the account, each with its own key
      const me = ownerOf(r.request().headers()["authorization"] ?? ""), items: { id: string; key: string }[] = r.request().postDataJSON().p_items;
      (board.claims ??= []).push(items);
      let n = 0;
      for (const c of items) {
        const post = (board.posts as { id: string; delete_key_hash: string }[]).find((p) => p.id === c.id);
        if (me && post && !board.owners?.[c.id] && post.delete_key_hash === createHash("sha256").update(c.key).digest("hex")) { (board.owners ??= {})[c.id] = me; n++; }
      }
      return r.fulfill({ json: n });
    }
    if (method === "GET" || method === "HEAD") { // ideas for the sky, dreams for the sea; older pages and the total, as PostgREST answers them
      const q = new URL(url).searchParams, kind = q.get("kind"), before = q.get("created_at"), limit = Number(q.get("limit") ?? "60");
      const ofKind = board.rows.filter((x) => kind === "eq.dream" ? x.kind === "dream" : x.kind !== "dream")
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      if (method === "HEAD") return r.fulfill({ status: 200, headers: { "content-range": `*/${ofKind.length}`, "access-control-expose-headers": "Content-Range", "access-control-allow-origin": "*" }, body: "" });
      const page = before ? ofKind.filter((x) => Date.parse(x.created_at) < Date.parse(before.slice(3))) : ofKind;
      return r.fulfill({ json: page.slice(0, limit) });
    }
    if (url.endsWith("/rest/v1/ideas")) {
      const body = r.request().postDataJSON(), poster = ownerOf(r.request().headers()["authorization"] ?? "");
      board.posts.push(body);
      if (poster) (board.owners ??= {})[body.id] = poster; // posted while signed in: it is that account's
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
    if (url.endsWith("/rpc/delete_idea")) {
      const b = r.request().postDataJSON(), me = ownerOf(r.request().headers()["authorization"] ?? "");
      const byKey = !!b.p_key && (board.posts as { id: string; delete_key_hash: string }[]).some((p) => p.id === b.p_id && p.delete_key_hash === createHash("sha256").update(b.p_key).digest("hex"));
      const byAccount = !!me && board.owners?.[b.p_id] === me;
      const known = (board.posts as { id: string }[]).some((p) => p.id === b.p_id);
      if (known && !byKey && !byAccount) return r.fulfill({ json: false }); // a post made here, and not yours either way
      board.deletes.push(b);
      board.rows = board.rows.filter((x) => x.id !== b.p_id);
      return r.fulfill({ json: true });
    }
    return r.fulfill({ status: 404 });
  });
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
export const withGio = (): Board => ({ rows: [{ ...gioRow }], posts: [], deletes: [] });

/** Who is signed in, from a request's "Authorization: Bearer <token>" (the token's claims; tests don't sign tokens). */
function ownerOf(bearer: string): string | null {
  const part = bearer.replace(/^Bearer /, "").split(".")[1];
  if (!part) return null;
  try { return JSON.parse(Buffer.from(part, "base64url").toString()).sub ?? null; } catch { return null; }
}

/** What a sign-in link brings back in the address: a token shaped like Supabase's (its signature isn't checked by the page). */
export function signInReturn(email: string, id = "user-1"): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = `${b64({ alg: "HS256" })}.${b64({ sub: id, email, exp: 4_000_000_000 })}.sig`;
  return `#access_token=${token}&expires_in=3600&refresh_token=r-${id}&token_type=bearer&type=magiclink`;
}
