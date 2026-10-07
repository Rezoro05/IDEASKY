/** Supabase Edge Function `categorize`: POST { id } → { categories } for that idea or dream (dreams get themes), asking Jev (TypeSafe) once and saving the answer.
 *  Secrets it reads: JEV_API_KEY (set by the owner); SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (provided by Supabase).
 *  Deploy with "Verify JWT" off: the site calls it with its public key, and the function only ever sorts ideas that exist and have no categories yet. */
import { LISTS } from "../_shared/categories.ts";
import { categorize, noulAnswers, type CategorizeDeps } from "../_shared/categorize.ts";

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "apikey, authorization, content-type" };

const env = (name: string): string => Deno.env.get(name) ?? "";
/** A failed outside call, for the function's Logs tab: which call, its status and the start of its answer (never a key). */
const logFailure = async (what: string, r: Response) => console.error(`${what} failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
const dbHeaders = (key: string): Record<string, string> =>
  ({ apikey: key, "Content-Type": "application/json", ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}) });

function deps(): CategorizeDeps {
  const url = env("SUPABASE_URL"), headers = dbHeaders(env("SUPABASE_SERVICE_ROLE_KEY"));
  return {
    async load(id) {
      try {
        const r = await fetch(`${url}/rest/v1/ideas?id=eq.${id}&select=message,categories,kind`, { headers });
        if (!r.ok) { await logFailure("reading the idea", r); return "error"; }
        const rows = (await r.json()) as { message: string; categories: unknown; kind?: unknown }[];
        return rows[0] ?? null;
      } catch (e) { console.error(`reading the idea failed: ${e}`); return "error"; }
    },
    async ask(state, questions) {
      try {
        const r = await fetch(JEV_URL, {
          method: "POST",
          headers: { Authorization: "Bearer " + env("JEV_API_KEY"), "Content-Type": "application/json" },
          body: JSON.stringify({ model: "jev-latest", state, questions }),
        });
        if (!r.ok) { await logFailure("asking Jev", r); return null; }
        const answers = noulAnswers(await r.json());
        if (!answers) console.error("asking Jev failed: the answer had no yes/no answers in it");
        return answers;
      } catch (e) { console.error(`asking Jev failed: ${e}`); return null; }
    },
    async save(id, categories) {
      try {
        const r = await fetch(`${url}/rest/v1/ideas?id=eq.${id}&categories=is.null`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ categories }),
        });
        if (!r.ok) await logFailure("saving the categories", r);
        return r.ok;
      } catch (e) { console.error(`saving the categories failed: ${e}`); return false; }
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return Response.json({ categories: null }, { status: 405, headers: CORS });
  let body: unknown = null;
  try { body = await req.json(); } catch { /* answered as a bad request below */ }
  if (!env("JEV_API_KEY")) console.error("JEV_API_KEY is not set in this project's Edge Function secrets");
  if (!env("SUPABASE_SERVICE_ROLE_KEY")) console.error("SUPABASE_SERVICE_ROLE_KEY is not available to this function");
  const reply = await categorize(body, LISTS, deps());
  return Response.json({ categories: reply.categories, ...(reply.failed ? { failed: reply.failed } : {}) }, { status: reply.status, headers: CORS });
});
