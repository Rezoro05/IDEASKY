/** Where visitor ideas live. One interface, two places:
 *  - Supabase (the public board)
 *  - memory (tests, and local runs with no board configured; ideas last until the page reloads)
 *  Every adapter turns failures into `false`, so the page never breaks because a board is down. */
import { cleanIdea, type Idea } from "../lib/ideas";
import { isOneStep, type Stage } from "../lib/stages";
import type { KeyStore } from "./keyStore";

export interface IdeaStore {
  /** Starts listening; calls back with the full set whenever it changes. Returns false if the board isn't reachable. */
  subscribe(onIdeas: (ideas: Map<string, Idea>) => void): Promise<boolean>;
  add(idea: Idea): Promise<boolean>;
  remove(idea: Idea): Promise<boolean>;
  /** Move an idea one step, as its owner. False if this browser isn't the owner, the move isn't one step, or saving failed. */
  setStage(idea: Idea, to: Stage): Promise<boolean>;
  /** Did this browser post this idea (so it may act as its owner)? */
  ownsKey(id: string): boolean;
}

/* ---------- Supabase ---------- */
export type SupabaseDeps = {
  url: string;
  key: string;
  fetch: typeof fetch;
  keys: KeyStore;
  randomBytes: (n: number) => Uint8Array;
  sha256Hex: (text: string) => Promise<string>;
};

export const toHex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export function supabaseHeaders(key: string): Record<string, string> {
  // Legacy anon keys are JWTs and also go in Authorization; new publishable keys go in apikey only.
  return { apikey: key, "Content-Type": "application/json", ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}) };
}

export function supabaseStore(d: SupabaseDeps): IdeaStore {
  const headers = supabaseHeaders(d.key);
  return {
    async subscribe(onIdeas) {
      try {
        const r = await d.fetch(d.url + "/rest/v1/ideas?select=id,name,message,stage,links,categories,created_at&order=created_at.desc&limit=60", { headers });
        if (!r.ok) return false;
        const rows = (await r.json()) as { id: string; name: string; message: string; stage: unknown; links: unknown; categories?: unknown; created_at: string }[];
        const out = new Map<string, Idea>();
        for (const row of rows) {
          const idea = cleanIdea({ id: row.id, name: row.name, message: row.message, stage: row.stage, links: row.links, categories: row.categories, at: Date.parse(row.created_at) });
          if (idea) out.set(idea.id, idea);
        }
        onIdeas(out);
        return true;
      } catch { return false; }
    },
    async add(idea) {
      try {
        const deleteKey = toHex(d.randomBytes(16));
        const r = await d.fetch(d.url + "/rest/v1/ideas", {
          method: "POST", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ id: idea.id, name: idea.name, message: idea.message, links: idea.links, delete_key_hash: await d.sha256Hex(deleteKey) }),
        });
        if (!r.ok) return false;
        d.keys.set(idea.id, deleteKey);
        return true;
      } catch { return false; }
    },
    async remove(idea) {
      const key = d.keys.get(idea.id);
      if (!key) return false;
      try {
        const r = await d.fetch(d.url + "/rest/v1/rpc/delete_idea", { method: "POST", headers, body: JSON.stringify({ p_id: idea.id, p_key: key }) });
        if (!r.ok) return false;
        const ok = !!(await r.json());
        if (ok) d.keys.drop(idea.id);
        return ok;
      } catch { return false; }
    },
    async setStage(idea, to) {
      const key = d.keys.get(idea.id);
      if (!key || !isOneStep(idea.stage, to)) return false;
      try {
        const r = await d.fetch(d.url + "/rest/v1/rpc/set_idea_stage", { method: "POST", headers, body: JSON.stringify({ p_id: idea.id, p_key: key, p_stage: to }) });
        return r.ok && !!(await r.json());
      } catch { return false; }
    },
    ownsKey: (id) => !!d.keys.get(id),
  };
}

/* ---------- memory ---------- */
export function memoryStore(initial: Idea[] = [], opts: { failWrites?: boolean } = {}): IdeaStore & { ideas: Map<string, Idea> } {
  const ideas = new Map(initial.map((n) => [n.id, n]));
  const postedHere = new Set<string>();
  let listener: ((n: Map<string, Idea>) => void) | null = null;
  const emit = () => listener?.(new Map(ideas));
  return {
    ideas,
    async subscribe(onIdeas) { listener = onIdeas; emit(); return true; },
    async add(idea) { if (opts.failWrites) return false; ideas.set(idea.id, idea); postedHere.add(idea.id); emit(); return true; },
    async remove(idea) {
      if (opts.failWrites || !postedHere.has(idea.id)) return false;
      postedHere.delete(idea.id); ideas.delete(idea.id); emit(); return true;
    },
    async setStage(idea, to) {
      const kept = ideas.get(idea.id);
      if (opts.failWrites || !kept || !postedHere.has(idea.id) || !isOneStep(kept.stage, to)) return false;
      ideas.set(idea.id, { ...kept, stage: to }); emit(); return true;
    },
    ownsKey: (id) => postedHere.has(id),
  };
}
