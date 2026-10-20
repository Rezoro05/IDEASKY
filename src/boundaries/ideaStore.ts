/** Where visitor ideas live. One interface, two places:
 *  - Supabase (the public board)
 *  - memory (tests, and local runs with no board configured; ideas last until the page reloads)
 *  Every adapter turns failures into `false`, so the page never breaks because a board is down. */
import { cleanIdea, type Idea } from "../lib/ideas";
import { countFromContentRange } from "../lib/likes";
import { isOneStep, type Stage } from "../lib/stages";
import type { Kind } from "../lib/categories";
import type { KeyStore } from "./keyStore";
import type { AccountPosts } from "./accountPosts";

export interface IdeaStore {
  /** Starts listening; calls back with the full set whenever it changes. Returns false if the board isn't reachable. */
  subscribe(onIdeas: (ideas: Map<string, Idea>) => void): Promise<boolean>;
  add(idea: Idea): Promise<boolean>;
  remove(idea: Idea): Promise<boolean>;
  /** Move an idea one step, as its owner. False if this browser isn't the owner, the move isn't one step, or saving failed. */
  setStage(idea: Idea, to: Stage): Promise<boolean>;
  /** Did this browser post this idea (so it may act as its owner)? */
  ownsKey(id: string): boolean;
  /** Older ones, for browsing: up to `limit` posted before `before` (ms), newest first. null = couldn't load. Absent = everything is already loaded. */
  older?(before: number, limit: number): Promise<Idea[] | null>;
  /** How many there are in all (so numbers stay the same however many are loaded). null = unknown. */
  total?(): Promise<number | null>;
}

/** The columns a board shows, and turning its rows into ideas. */
const COLUMNS = "id,name,message,stage,links,categories,created_at";
type Row = { id: string; name: string; message: string; stage: unknown; links: unknown; categories?: unknown; created_at: string };
const toIdea = (row: Row, kind: Kind): Idea | null => cleanIdea({ id: row.id, name: row.name, message: row.message, stage: row.stage, links: row.links, categories: row.categories, at: Date.parse(row.created_at) }, kind);

/* ---------- Supabase ---------- */
export type SupabaseDeps = {
  url: string;
  key: string;
  fetch: typeof fetch;
  keys: KeyStore;
  randomBytes: (n: number) => Uint8Array;
  sha256Hex: (text: string) => Promise<string>;
  /** Ideas (the sky, the default) or dreams (the sea): the same table, told apart by `kind`. */
  kind?: Kind;
  /** Signed in: posts carry your sign-in (they become yours), and posts that are yours by account can be managed from any browser. */
  account?: AccountPosts;
};

export const toHex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export function supabaseHeaders(key: string): Record<string, string> {
  // Legacy anon keys are JWTs and also go in Authorization; new publishable keys go in apikey only.
  return { apikey: key, "Content-Type": "application/json", ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}) };
}

export function supabaseStore(d: SupabaseDeps): IdeaStore {
  const headers = supabaseHeaders(d.key), kind: Kind = d.kind ?? "idea";
  /** The public key's headers, plus your sign-in when you have one (so the database knows the post is yours). */
  const signedIn = async (): Promise<Record<string, string>> => {
    const token = await d.account?.token().catch(() => null);
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
  };
  return {
    async subscribe(onIdeas) {
      try {
        const r = await d.fetch(d.url + `/rest/v1/ideas?select=${COLUMNS}&kind=eq.${kind}&order=created_at.desc&limit=60`, { headers });
        if (!r.ok) return false;
        const out = new Map<string, Idea>();
        for (const row of (await r.json()) as Row[]) { const idea = toIdea(row, kind); if (idea) out.set(idea.id, idea); }
        onIdeas(out);
        return true;
      } catch { return false; }
    },
    async older(before, limit) {
      try {
        const at = encodeURIComponent(new Date(before).toISOString());
        const r = await d.fetch(d.url + `/rest/v1/ideas?select=${COLUMNS}&kind=eq.${kind}&created_at=lt.${at}&order=created_at.desc&limit=${limit}`, { headers });
        if (!r.ok) return null;
        return ((await r.json()) as Row[]).map((row) => toIdea(row, kind)).filter((n): n is Idea => n !== null);
      } catch { return null; }
    },
    async total() {
      try {
        const r = await d.fetch(d.url + `/rest/v1/ideas?select=id&kind=eq.${kind}`, { method: "HEAD", headers: { ...headers, Prefer: "count=exact" } });
        return r.ok ? countFromContentRange(r.headers.get("content-range")) : null;
      } catch { return null; }
    },
    async add(idea) {
      try {
        const deleteKey = toHex(d.randomBytes(16)), as = await signedIn();
        const r = await d.fetch(d.url + "/rest/v1/ideas", {
          method: "POST", headers: { ...as, Prefer: "return=minimal" },
          body: JSON.stringify({ id: idea.id, name: idea.name, message: idea.message, links: idea.links, delete_key_hash: await d.sha256Hex(deleteKey), ...(kind === "dream" ? { kind } : {}), ...(idea.contactEmail ? { contact_email: idea.contactEmail } : {}) }),
        });
        if (!r.ok) return false;
        d.keys.set(idea.id, deleteKey);
        if (as !== headers) d.account?.added(idea.id);
        return true;
      } catch { return false; }
    },
    async remove(idea) {
      const key = d.keys.get(idea.id) ?? null;
      if (!key && !d.account?.owns(idea.id)) return false;
      try {
        const r = await d.fetch(d.url + "/rest/v1/rpc/delete_idea", { method: "POST", headers: await signedIn(), body: JSON.stringify({ p_id: idea.id, p_key: key }) });
        if (!r.ok) return false;
        const ok = !!(await r.json());
        if (ok) d.keys.drop(idea.id);
        return ok;
      } catch { return false; }
    },
    async setStage(idea, to) {
      const key = d.keys.get(idea.id) ?? null;
      if ((!key && !d.account?.owns(idea.id)) || !isOneStep(idea.stage, to)) return false;
      try {
        const r = await d.fetch(d.url + "/rest/v1/rpc/set_idea_stage", { method: "POST", headers: await signedIn(), body: JSON.stringify({ p_id: idea.id, p_key: key, p_stage: to }) });
        return r.ok && !!(await r.json());
      } catch { return false; }
    },
    ownsKey: (id) => !!d.keys.get(id) || !!d.account?.owns(id),
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
