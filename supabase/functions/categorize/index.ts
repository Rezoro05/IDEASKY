/** Supabase Edge Function `categorize`: POST { id } → { categories } for that idea or dream (dreams get themes), asking Jev (TypeSafe) once and saving the answer.
 *  POST { id, private: true } sorts a signed-in visitor's own private idea or dream: it is read and saved with the visitor's own sign-in
 *  (their Authorization header), so the database's owner-only rules decide what it may touch; no service key is used for those.
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

/** Where the record lives and as whom it is read: the public table with the service key, or a private one as its signed-in owner. */
type Place = { table: "ideas" | "private_items"; headers: Record<string, string> };

function deps(place: Place): CategorizeDeps {
  const url = env("SUPABASE_URL"), { table, headers } = place;
  return {
    async load(id) {
      try {
        const r = await fetch(`${url}/rest/v1/${table}?id=eq.${id}&select=message,categories,kind`, { headers });
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
        const r = await fetch(`${url}/rest/v1/${table}?id=eq.${id}&or=(categories.is.null,categories.eq.%7B%7D)`, { // not sorted yet, or [] from the old rule
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
  const wantsPrivate = !!body && typeof body === "object" && (body as { private?: unknown }).private === true;
  const auth = req.headers.get("authorization") ?? "", apikey = req.headers.get("apikey") ?? "";
  if (wantsPrivate && !auth.startsWith("Bearer ")) return Response.json({ categories: null }, { status: 401, headers: CORS }); // private needs a signed-in owner
  const place: Place = wantsPrivate
    ? { table: "private_items", headers: { apikey, Authorization: auth, "Content-Type": "application/json" } }
    : { table: "ideas", headers: dbHeaders(env("SUPABASE_SERVICE_ROLE_KEY")) };
  const reply = await categorize(body, LISTS, deps(place));
  return Response.json({ categories: reply.categories, ...(reply.failed ? { failed: reply.failed } : {}) }, { status: reply.status, headers: CORS });
});
