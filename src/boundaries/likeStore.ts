/** Where likes live. Same two places and the same failure rule as the other stores: failures become null/false.
 *  A like belongs to this browser: a random liker id kept in browser storage; only its hash goes to the database. */
import { countFromContentRange } from "../lib/likes";
import { supabaseHeaders, toHex } from "./ideaStore";
import type { KeyStore } from "./keyStore";

export interface LikeStore {
  /** null = couldn't load */
  count(ideaId: string): Promise<number | null>;
  /** Likes on many at once (ids with none are left out). null = couldn't load. */
  counts(ideaIds: string[]): Promise<Map<string, number> | null>;
  /** Did this browser like it? Answered from browser storage, no network. */
  likedHere(ideaId: string): boolean;
  like(ideaId: string): Promise<boolean>;
  unlike(ideaId: string): Promise<boolean>;
}

/** This browser's liker id, made once and kept. Storage may be missing: then it lasts for this visit. */
export function likerIdFrom(keys: KeyStore, randomBytes: (n: number) => Uint8Array): () => string {
  let visitOnly: string | null = null;
  return () => {
    const kept = keys.get("liker");
    if (kept) return kept;
    visitOnly ??= toHex(randomBytes(16));
    keys.set("liker", visitOnly);
    return visitOnly;
  };
}

/* ---------- Supabase ---------- */
export type SupabaseLikeDeps = {
  url: string; key: string; fetch: typeof fetch;
  /** Ideas liked from this browser (value "1"), plus the liker id under "liker". */
  keys: KeyStore;
  likerId: () => string;
  sha256Hex: (text: string) => Promise<string>;
  /** True once the page is unloading: a request cut off by leaving is not a failure, so the like is kept. */
  pageIsLeaving?: () => boolean;
};

export function supabaseLikes(d: SupabaseLikeDeps): LikeStore {
  const headers = supabaseHeaders(d.key);
  return {
    async count(ideaId) {
      try {
        const r = await d.fetch(`${d.url}/rest/v1/likes?select=idea_id&idea_id=eq.${encodeURIComponent(ideaId)}`,
          { method: "HEAD", headers: { ...headers, Prefer: "count=exact" } });
        return r.ok ? countFromContentRange(r.headers.get("content-range")) : null;
      } catch { return null; }
    },
    async counts(ids) {
      if (ids.length === 0) return new Map();
      try { // counted by the database (like_counts), one row per liked idea
        const r = await d.fetch(`${d.url}/rest/v1/rpc/like_counts`, { method: "POST", headers, body: JSON.stringify({ p_ids: ids }) });
        if (!r.ok) return null;
        const rows = (await r.json()) as { idea_id?: unknown; likes?: unknown }[];
        return new Map(rows.filter((x) => typeof x.idea_id === "string" && Number(x.likes) > 0).map((x) => [x.idea_id as string, Number(x.likes)]));
      } catch { return null; }
    },
    likedHere: (ideaId) => d.keys.get(ideaId) === "1",
    /* The browser remembers the change before it is sent and takes it back only if sending really failed,
       not when a reload or navigation cut the request off. */
    async like(ideaId) {
      d.keys.set(ideaId, "1");
      try {
        const r = await d.fetch(d.url + "/rest/v1/likes", {
          method: "POST", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ idea_id: ideaId, liker_hash: await d.sha256Hex(d.likerId()) }),
        });
        if (r.ok || r.status === 409) return true; // 409: this browser already liked it
      } catch { if (d.pageIsLeaving?.()) return false; }
      d.keys.drop(ideaId);
      return false;
    },
    async unlike(ideaId) {
      d.keys.drop(ideaId);
      try {
        const r = await d.fetch(d.url + "/rest/v1/rpc/unlike_idea", { method: "POST", headers, body: JSON.stringify({ p_idea_id: ideaId, p_liker: d.likerId() }) });
        if (r.ok) return true;
      } catch { if (d.pageIsLeaving?.()) return false; }
      d.keys.set(ideaId, "1");
      return false;
    },
  };
}

/* ---------- memory ---------- */
export function memoryLikes(initial: Record<string, number> = {}, opts: { failWrites?: boolean; failReads?: boolean } = {}): LikeStore {
  const counts = new Map(Object.entries(initial)), likedHere = new Set<string>();
  return {
    async count(ideaId) { return opts.failReads ? null : counts.get(ideaId) ?? 0; },
    async counts(ids) { return opts.failReads ? null : new Map(ids.filter((id) => (counts.get(id) ?? 0) > 0).map((id) => [id, counts.get(id)!])); },
    likedHere: (ideaId) => likedHere.has(ideaId),
    async like(ideaId) {
      if (opts.failWrites) return false;
      if (!likedHere.has(ideaId)) { likedHere.add(ideaId); counts.set(ideaId, (counts.get(ideaId) ?? 0) + 1); }
      return true;
    },
    async unlike(ideaId) {
      if (opts.failWrites) return false;
      if (likedHere.delete(ideaId)) counts.set(ideaId, Math.max(0, (counts.get(ideaId) ?? 0) - 1));
      return true;
    },
  };
}
