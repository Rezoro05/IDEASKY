/** Where likes on comments live. Same rules as idea likes (likeStore): one per browser, only the liker id's hash leaves the browser,
 *  the browser remembers its likes, and failures become null/false (never an exception). */
import { tally } from "../lib/comments";
import { supabaseHeaders } from "./ideaStore";
import type { KeyStore } from "./keyStore";

export interface CommentLikeStore {
  /** Likes per comment, for all of an idea's comments at once (comments with none are left out). null = couldn't load. */
  counts(commentIds: readonly string[]): Promise<Map<string, number> | null>;
  /** Did this browser like it? Answered from browser storage, no network. */
  likedHere(commentId: string): boolean;
  like(commentId: string): Promise<boolean>;
  unlike(commentId: string): Promise<boolean>;
}

export type SupabaseCommentLikeDeps = {
  url: string; key: string; fetch: typeof fetch;
  /** Comments liked from this browser (value "1"). */
  keys: KeyStore;
  /** The same liker id the idea likes use. */
  likerId: () => string;
  sha256Hex: (text: string) => Promise<string>;
  pageIsLeaving?: () => boolean;
};

export function supabaseCommentLikes(d: SupabaseCommentLikeDeps): CommentLikeStore {
  const headers = supabaseHeaders(d.key);
  return {
    async counts(ids) {
      if (ids.length === 0) return new Map();
      try {
        const r = await d.fetch(`${d.url}/rest/v1/comment_likes?select=comment_id&comment_id=in.(${ids.map(encodeURIComponent).join(",")})`, { headers });
        if (!r.ok) return null;
        return tally(((await r.json()) as { comment_id: string }[]).map((row) => row.comment_id));
      } catch { return null; }
    },
    likedHere: (id) => d.keys.get(id) === "1",
    async like(id) {
      d.keys.set(id, "1");
      try {
        const r = await d.fetch(d.url + "/rest/v1/comment_likes", {
          method: "POST", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ comment_id: id, liker_hash: await d.sha256Hex(d.likerId()) }),
        });
        if (r.ok || r.status === 409) return true; // 409: this browser already liked it
      } catch { if (d.pageIsLeaving?.()) return false; }
      d.keys.drop(id);
      return false;
    },
    async unlike(id) {
      d.keys.drop(id);
      try {
        const r = await d.fetch(d.url + "/rest/v1/rpc/unlike_comment", { method: "POST", headers, body: JSON.stringify({ p_comment_id: id, p_liker: d.likerId() }) });
        if (r.ok) return true;
      } catch { if (d.pageIsLeaving?.()) return false; }
      d.keys.set(id, "1");
      return false;
    },
  };
}

export function memoryCommentLikes(initial: Record<string, number> = {}, opts: { failWrites?: boolean; failReads?: boolean } = {}): CommentLikeStore {
  const counts = new Map(Object.entries(initial)), mine = new Set<string>();
  return {
    async counts(ids) {
      if (opts.failReads) return null;
      return new Map(ids.flatMap((id) => (counts.get(id) ? [[id, counts.get(id)!] as const] : [])));
    },
    likedHere: (id) => mine.has(id),
    async like(id) {
      if (opts.failWrites) return false;
      if (!mine.has(id)) { mine.add(id); counts.set(id, (counts.get(id) ?? 0) + 1); }
      return true;
    },
    async unlike(id) {
      if (opts.failWrites) return false;
      if (mine.delete(id)) counts.set(id, Math.max(0, (counts.get(id) ?? 0) - 1));
      return true;
    },
  };
}
