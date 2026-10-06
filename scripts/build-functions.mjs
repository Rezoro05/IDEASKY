/** Bundles each Edge Function with its shared files into one file, ready to paste into the Supabase dashboard
 *  (Edge Functions → Deploy a new function → via Editor). Output: build-functions/<name>/index.ts. */
import { build } from "esbuild";
import { readdirSync, existsSync } from "node:fs";

const names = readdirSync("supabase/functions").filter((n) => !n.startsWith("_") && existsSync(`supabase/functions/${n}/index.ts`));
for (const name of names) {
  await build({
    entryPoints: [`supabase/functions/${name}/index.ts`], outfile: `build-functions/${name}/index.ts`,
    bundle: true, format: "esm", platform: "neutral", target: "es2022", legalComments: "none",
    banner: { js: `// Built from supabase/functions/${name}/ by scripts/build-functions.mjs. Edit the source, not this file.` },
  });
  console.log(`build-functions/${name}/index.ts`);
}
