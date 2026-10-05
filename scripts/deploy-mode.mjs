// Decides what the deploy workflow builds, from the service settings it was given.
//   all three set  -> "live": the real board and inbox
//   none set       -> "preview": an in-memory board with five example ideas (nothing is saved, nothing is emailed)
//   some set       -> "error": a half-configured deploy is a mistake, so it stops and names what is missing
// The decision (deployMode) is pure; the command line at the bottom reports it to GitHub Actions.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SERVICE_VARIABLES = ["PUBLIC_BOARD_URL", "PUBLIC_BOARD_KEY", "PUBLIC_FORMSPREE_ENDPOINT"];

export function deployMode(env) {
  const isSet = (name) => typeof env[name] === "string" && env[name].trim() !== "";
  const missing = SERVICE_VARIABLES.filter((name) => !isSet(name));
  if (missing.length === 0) return { mode: "live" };
  if (missing.length === SERVICE_VARIABLES.length) return { mode: "preview", buildEnv: { PUBLIC_DEMO_IDEAS: "1" } };
  return { mode: "error", missing };
}

function main() {
  const result = deployMode(process.env);
  if (result.mode === "error") {
    for (const name of result.missing) console.log(`::error::Repository variable ${name} is not set (Settings → Secrets and variables → Actions → Variables). Set all three, or none for a preview.`);
    process.exit(1);
  }
  if (result.mode === "preview") {
    console.log("::notice::No services are configured: publishing a PREVIEW (in-memory board with example ideas; nothing is saved or emailed).");
    if (process.env.GITHUB_ENV) for (const [k, v] of Object.entries(result.buildEnv)) appendFileSync(process.env.GITHUB_ENV, `${k}=${v}\n`);
  } else {
    console.log("Services are configured: publishing the live site.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
