/** Which ideas and dreams the sky and the sea show: everyone's (public) or the signed-in visitor's own (mine). Pure.
 *  Signed out, always public. Signing in opens your own sky and sea; the "Public" button switches, and the choice is remembered. */
export type Mode = "public" | "mine";

export function startingMode(o: { signedIn: boolean; remembered: unknown; openingPublicIdea: boolean }): Mode {
  if (!o.signedIn) return "public";
  if (o.openingPublicIdea) return "public"; // a link to a public idea opens where that idea is
  return o.remembered === "public" ? "public" : "mine";
}

/** After signing in or out: in on sign-in, public on sign-out. */
export const modeAfterSignIn = (signedIn: boolean): Mode => (signedIn ? "mine" : "public");
