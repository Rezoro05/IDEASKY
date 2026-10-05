export const SERVICE_VARIABLES: readonly string[];
export type DeployMode =
  | { mode: "live" }
  | { mode: "preview"; buildEnv: { PUBLIC_DEMO_IDEAS: string } }
  | { mode: "error"; missing: string[] };
export function deployMode(env: Record<string, string | undefined>): DeployMode;
