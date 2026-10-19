/** The signed-in visitor's own ideas and dreams (their private sky and sea), behind the same IdeaStore interface as the public board.
 *  Every request carries the visitor's sign-in; the database lets each owner see and change only their own rows (supabase/09).
 *  Never throws: failures come back as `false` or `null`, as in every store. */
import { cleanIdea, type Idea } from "../lib/ideas";
import { isOneStep } from "../lib/stages";
import type { Kind } from "../lib/categories";
import type { IdeaStore } from "./ideaStore";
import type { Categorizer } from "./categorizer";

export type PrivateDeps = {
  url: string; key: string; fetch: typeof fetch;
  /** The visitor's access token now (renewed if needed), or null when signed out. */
  token: () => Promise<string | null>;
  kind: Kind;
};

async function authed(d: Pick<PrivateDeps, "key" | "token">, extra: Record<string, string> = {}): Promise<Record<string, string> | null> {
  const token = await d.token();
  return token ? { apikey: d.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra } : null;
}

export function supabasePrivateStore(d: PrivateDeps): IdeaStore {
  const table = `${d.url}/rest/v1/private_items`;
  return {
    async subscribe(onIdeas) {
      try {
        const headers = await authed(d);
        if (!headers) return false;
        const r = await d.fetch(`${table}?select=id,name,message,stage,links,categories,created_at&kind=eq.${d.kind}&order=created_at.desc&limit=200`, { headers });
        if (!r.ok) return false;
        const rows = (await r.json()) as { id: string; name: string; message: string; stage: unknown; links: unknown; categories?: unknown; created_at: string }[];
        const out = new Map<string, Idea>();
        for (const row of rows) {
          const idea = cleanIdea({ id: row.id, name: row.name, message: row.message, stage: row.stage, links: row.links, categories: row.categories, at: Date.parse(row.created_at) }, d.kind);
          if (idea) out.set(idea.id, idea);
        }
        onIdeas(out);
        return true;
      } catch { return false; }
    },
    async add(idea) {
      try {
        const headers = await authed(d, { Prefer: "return=minimal" });
        if (!headers) return false;
        const r = await d.fetch(table, { method: "POST", headers, body: JSON.stringify({ id: idea.id, kind: d.kind, name: idea.name, message: idea.message, links: idea.links }) });
        return r.ok;
      } catch { return false; }
    },
    async remove(idea) {
      try {
        const headers = await authed(d, { Prefer: "return=representation" });
        if (!headers) return false;
        const r = await d.fetch(`${table}?id=eq.${idea.id}`, { method: "DELETE", headers });
        return r.ok && ((await r.json()) as unknown[]).length > 0; // nothing removed = not theirs, or already gone
      } catch { return false; }
    },
    async setStage(idea, to) {
      if (!isOneStep(idea.stage, to)) return false;
      try {
        const headers = await authed(d, { Prefer: "return=representation" });
        if (!headers) return false;
        const r = await d.fetch(`${table}?id=eq.${idea.id}`, { method: "PATCH", headers, body: JSON.stringify({ stage: to }) });
        return r.ok && ((await r.json()) as unknown[]).length > 0;
      } catch { return false; }
    },
    ownsKey: () => true, // everything in your own sky is yours
  };
}

/** Sorting a private idea or dream: the `categorize` function reads and saves it with the visitor's own sign-in. */
export function privateCategorizer(d: Omit<PrivateDeps, "kind">): Categorizer {
  return {
    async categorize(id) {
      try {
        const headers = await authed(d);
        if (!headers) return null;
        const r = await d.fetch(`${d.url}/functions/v1/categorize`, { method: "POST", headers, body: JSON.stringify({ id, private: true }) });
        if (!r.ok) return null;
        const body = (await r.json()) as { categories?: unknown };
        return Array.isArray(body.categories) ? body.categories.filter((k): k is string => typeof k === "string") : null;
      } catch { return null; }
    },
  };
}
