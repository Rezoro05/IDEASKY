/** Asks the `categorize` Edge Function to sort an idea (it asks Jev, once, and saves the answer). Never throws: no answer is null. */
import { supabaseHeaders } from "./ideaStore";

export type Categorizer = {
  /** The idea's categories once sorted ([] if none fit), or null if they couldn't be found out now. */
  categorize(ideaId: string): Promise<string[] | null>;
};

export function supabaseCategorizer(d: { url: string; key: string; fetch: typeof fetch }): Categorizer {
  return {
    async categorize(ideaId) {
      try {
        const r = await d.fetch(d.url + "/functions/v1/categorize", { method: "POST", headers: supabaseHeaders(d.key), body: JSON.stringify({ id: ideaId }) });
        if (!r.ok) return null;
        const body = (await r.json()) as { categories?: unknown };
        return Array.isArray(body.categories) ? body.categories.filter((k): k is string => typeof k === "string") : null;
      } catch { return null; }
    },
  };
}

/** No function to ask (local runs, previews): ideas stay unsorted. */
export const noCategorizer: Categorizer = { categorize: async () => null };
