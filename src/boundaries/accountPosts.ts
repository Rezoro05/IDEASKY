/** Public posts that belong to the signed-in account (supabase/migrations/…14): posted while signed in, or made from this browser
 *  before signing in and claimed with their keys. Owning one lets you remove it, move its stage and add updates from any browser.
 *  Only ids are ever asked for, and only your own: nobody sees who owns what. Never throws; failures leave it as it was. */
import type { Auth } from "./auth";
import type { KeyStore } from "./keyStore";
import { supabaseHeaders } from "./ideaStore";

export interface AccountPosts {
  /** A fresh sign-in token for requests, or null when signed out. */
  token(): Promise<string | null>;
  /** Is this public post yours by account? */
  owns(id: string): boolean;
  /** You just posted it while signed in. */
  added(id: string): void;
}


export function supabaseAccountPosts(d: { url: string; key: string; fetch: typeof fetch; auth: Auth; ideaKeys: KeyStore }): AccountPosts {
  let mine = new Set<string>(), gen = 0;
  const call = async (fn: string, body: unknown, token: string): Promise<unknown> => {
    const r = await d.fetch(`${d.url}/rest/v1/rpc/${fn}`, { method: "POST", headers: { ...supabaseHeaders(d.key), Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    return r.ok ? r.json() : null;
  };
  d.auth.onChange(async (user) => {
    const g = ++gen;
    mine = new Set();
    if (!user) return;
    try {
      const token = await d.auth.token();
      if (!token) return;
      const keys = Object.entries(d.ideaKeys.all()).map(([id, key]) => ({ id, key }));
      if (keys.length) await call("claim_ideas", { p_items: keys.slice(0, 200) }, token); // this browser's earlier posts join the account
      const ids = await call("my_idea_ids", {}, token);
      if (g !== gen || !Array.isArray(ids)) return;
      mine = new Set(ids.map((x) => (typeof x === "string" ? x : (x as { my_idea_ids?: string }).my_idea_ids)).filter((x): x is string => typeof x === "string"));
    } catch { /* stays as it was: the browser keys still work */ }
  });
  return {
    token: () => d.auth.token(),
    owns: (id) => mine.has(id),
    added: (id) => { mine.add(id); },
  };
}
