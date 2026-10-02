/** Where owners' updates live. Same two places and the same failure rule as the other stores: failures become null/false.
 *  Only the idea's owner may add or remove an update: the browser proves it with the idea's own key,
 *  and the database checks that key against the idea's stored hash. */
import { cleanUpdate, UPDATE_LIMITS, type Update } from "../lib/updates";
import { supabaseHeaders } from "./ideaStore";
import type { KeyStore } from "./keyStore";

export interface UpdateStore {
  /** null = couldn't load */
  list(ideaId: string): Promise<Update[] | null>;
  add(update: Update): Promise<boolean>;
  remove(update: Update): Promise<boolean>;
  /** Is this browser the idea's owner (so it may add and remove updates)? */
  canManage(ideaId: string): boolean;
}

/* ---------- Supabase ---------- */
export type SupabaseUpdateDeps = { url: string; key: string; fetch: typeof fetch; ideaKeys: KeyStore };

export function supabaseUpdates(d: SupabaseUpdateDeps): UpdateStore {
  const headers = supabaseHeaders(d.key);
  const call = async (fn: string, body: unknown): Promise<boolean> => {
    try {
      const r = await d.fetch(`${d.url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(body) });
      return r.ok && !!(await r.json());
    } catch { return false; }
  };
  return {
    async list(ideaId) {
      try {
        const q = `/rest/v1/idea_updates?select=id,idea_id,message,links,created_at&idea_id=eq.${encodeURIComponent(ideaId)}&order=created_at.asc&limit=${UPDATE_LIMITS.perIdea}`;
        const r = await d.fetch(d.url + q, { headers });
        if (!r.ok) return null;
        const rows = (await r.json()) as { id: string; idea_id: string; message: string; links: unknown; created_at: string }[];
        return rows.map((row) => cleanUpdate({ id: row.id, ideaId: row.idea_id, message: row.message, links: row.links, at: Date.parse(row.created_at) }))
          .filter((u): u is Update => u !== null);
      } catch { return null; }
    },
    async add(u) {
      const key = d.ideaKeys.get(u.ideaId);
      return !!key && call("add_idea_update", { p_idea_id: u.ideaId, p_key: key, p_id: u.id, p_message: u.message, p_links: u.links });
    },
    async remove(u) {
      const key = d.ideaKeys.get(u.ideaId);
      return !!key && call("delete_idea_update", { p_id: u.id, p_key: key });
    },
    canManage: (ideaId) => !!d.ideaKeys.get(ideaId),
  };
}

/* ---------- memory ---------- */
export function memoryUpdates(ownsIdea: (ideaId: string) => boolean, initial: Update[] = [], opts: { failWrites?: boolean; failReads?: boolean } = {}): UpdateStore & { all: Map<string, Update> } {
  const all = new Map(initial.map((u) => [u.id, u]));
  return {
    all,
    async list(ideaId) { return opts.failReads ? null : [...all.values()].filter((u) => u.ideaId === ideaId); },
    async add(u) {
      if (opts.failWrites || !ownsIdea(u.ideaId) || [...all.values()].filter((x) => x.ideaId === u.ideaId).length >= UPDATE_LIMITS.perIdea) return false;
      all.set(u.id, u); return true;
    },
    async remove(u) { if (opts.failWrites || !ownsIdea(u.ideaId)) return false; return all.delete(u.id); },
    canManage: ownsIdea,
  };
}
