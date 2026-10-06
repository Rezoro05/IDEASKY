/** Supabase Edge Function `categorize`: POST { id } → { categories } for that idea, asking Jev (TypeSafe) once and saving the answer.
 *  Secrets it reads: JEV_API_KEY (set by the owner); SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (provided by Supabase).
 *  Deploy with "Verify JWT" off: the site calls it with its public key, and the function only ever sorts ideas that exist and have no categories yet. */
import { IDEA_CATEGORIES } from "../_shared/categories.ts";
import { categorize, noulAnswers, type CategorizeDeps } from "../_shared/categorize.ts";

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "apikey, authorization, content-type" };

const env = (name: string): string => Deno.env.get(name) ?? "";
const dbHeaders = (key: string): Record<string, string> =>
  ({ apikey: key, "Content-Type": "application/json", ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}) });

function deps(): CategorizeDeps {
  const url = env("SUPABASE_URL"), headers = dbHeaders(env("SUPABASE_SERVICE_ROLE_KEY"));
  return {
    async load(id) {
      try {
        const r = await fetch(`${url}/rest/v1/ideas?id=eq.${id}&select=message,categories`, { headers });
        if (!r.ok) return "error";
        const rows = (await r.json()) as { message: string; categories: unknown }[];
        return rows[0] ?? null;
      } catch { return "error"; }
    },
    async ask(state, questions) {
      try {
        const r = await fetch(JEV_URL, {
          method: "POST",
          headers: { Authorization: "Bearer " + env("JEV_API_KEY"), "Content-Type": "application/json" },
          body: JSON.stringify({ model: "jev-latest", state, questions }),
        });
        return r.ok ? noulAnswers(await r.json()) : null;
      } catch { return null; }
    },
    async save(id, categories) {
      try {
        const r = await fetch(`${url}/rest/v1/ideas?id=eq.${id}&categories=is.null`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ categories }),
        });
        return r.ok;
      } catch { return false; }
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return Response.json({ categories: null }, { status: 405, headers: CORS });
  let body: unknown = null;
  try { body = await req.json(); } catch { /* answered as a bad request below */ }
  const reply = await categorize(body, IDEA_CATEGORIES, deps());
  return Response.json({ categories: reply.categories }, { status: reply.status, headers: CORS });
});
