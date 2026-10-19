/** The account, on the page: the round initial (top right, once signed in), its menu, and the sign-in note.
 *  There is no Sign in button: choosing Private on the switch while signed out opens the note (`open`).
 *  The note: Continue with Google (leaves for Google, comes back signed in), or by email: asking ⇄ invalid → sending → sent (check your email)
 *  | asking with an error (text kept). In memory (local runs, the preview) both sign in at once. A sign-in link coming back (#access_token=… or #error=…) is taken on load and cleared from the address. */
import { authReturn, checkEmail, initialOf, returnAddress, type User } from "../lib/account";
import type { Auth } from "../boundaries/auth";
import { byId, cancelPendingOpen, hideOnEdit, openWithTransition } from "./dom";

const SAYS = {
  invalid: "That email address wasn’t accepted. Check it and try again.",
  tooMany: "Too many sign-in emails just now. Try again in a few minutes.",
  failed: "Couldn’t send the link just now. Try again in a moment.",
  signedIn: (email: string) => `Signed in as ${email}.`,
  signedOut: "Signed out.",
};

export type Account = { /** Open the sign-in note. */ open(): void };

export function startAccount(opts: { auth: Auth; say: (text: string) => void }): Account {
  const { auth, say } = opts;
  const me = byId<HTMLButtonElement>("account-me"), menu = byId("account-menu");
  const overlay = byId("signin"), form = byId<HTMLFormElement>("signin-form"), email = byId<HTMLInputElement>("signin-email");
  const err = byId("signin-error"), ask = byId("signin-ask"), sent = byId("signin-sent"), send = form.querySelector<HTMLButtonElement>(".signin-send")!;
  let attempt = 0;
  /** Where focus goes back to while signed out: the board you are on, on the switch. */
  const switchFocus = () => document.querySelector<HTMLInputElement>("#board-switch input:checked");

  // A sign-in link has just brought the visitor back: take the session, then take it out of the address.
  const back = authReturn(location.hash);
  if (back) {
    history.replaceState(null, "", location.pathname + location.search);
    if (back.kind === "error") say(back.text);
    else if (auth.accept(back.tokens)) say(SAYS.signedIn(auth.user()?.email ?? ""));
    else say("That sign-in link didn’t work. Ask for a new one.");
  }

  function show(user: User | null): void {
    me.hidden = !user;
    closeMenu(false);
    if (!user) return;
    byId("account-initial").textContent = initialOf(user.email);
    byId("account-email").textContent = user.email;
    me.setAttribute("aria-label", `Account: ${user.email}`);
  }
  auth.onChange(show);

  // The menu under the initial
  function closeMenu(returnFocus: boolean): void {
    if (menu.hidden) return;
    menu.hidden = true; me.setAttribute("aria-expanded", "false");
    if (returnFocus) me.focus({ preventScroll: true });
  }
  me.addEventListener("click", () => {
    const opening = menu.hidden;
    menu.hidden = !opening; me.setAttribute("aria-expanded", String(opening));
    if (opening) menu.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  });
  document.addEventListener("pointerdown", (e) => { if (!menu.hidden && !(e.target as Element).closest("#account")) closeMenu(false); }, true);
  byId("account-signout").addEventListener("click", async () => { closeMenu(false); await auth.signOut(); say(SAYS.signedOut); switchFocus()?.focus({ preventScroll: true }); });

  // The sign-in note
  const google = byId<HTMLButtonElement>("signin-google");
  function asking(): void { ask.hidden = false; sent.hidden = true; err.hidden = true; send.disabled = false; google.disabled = false; }
  // Google shows only when it is turned on in the service, so a site pushed before the setup never offers a button that fails.
  auth.google().then((on) => { byId("signin-google-wrap").hidden = !on; });
  google.addEventListener("click", async () => {
    google.disabled = true;
    const result = await auth.withGoogle(returnAddress(location.href));
    if (result === "signed-in") { const who = auth.user()?.email ?? ""; close(false); say(SAYS.signedIn(who)); return; }
    location.assign(result.go); // to Google; it comes back here signed in (or with #error=…)
  });
  function open(): void {
    form.reset(); asking();
    openWithTransition(overlay);
    email.focus({ preventScroll: true });
  }
  function close(returnFocus: boolean): void {
    attempt++;
    cancelPendingOpen(overlay);
    overlay.classList.remove("open"); overlay.hidden = true;
    form.reset(); asking();
    if (returnFocus) (me.hidden ? switchFocus() : me)?.focus({ preventScroll: true });
  }
  const isOpen = () => !overlay.hidden;
  byId("signin-close").addEventListener("click", () => close(true));
  byId("signin-again").addEventListener("click", () => { asking(); email.focus(); email.select(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(true); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (isOpen()) close(true);
    else closeMenu(true);
  });

  hideOnEdit(form, err);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (send.disabled) return;
    const check = checkEmail(email.value);
    if (!check.ok) { err.textContent = check.text; err.hidden = false; email.focus(); return; }
    err.hidden = true; send.disabled = true;
    const mine = ++attempt;
    const result = await auth.sendLink(check.email, returnAddress(location.href));
    if (mine !== attempt || !isOpen()) return; // closed while sending
    send.disabled = false;
    if (result === "signed-in") { close(false); say(SAYS.signedIn(check.email)); return; }
    if (result === "sent") { byId("signin-to").textContent = check.email; ask.hidden = true; sent.hidden = false; return; }
    err.textContent = result === "invalid" ? SAYS.invalid : result === "too-many" ? SAYS.tooMany : SAYS.failed;
    err.hidden = false;
  });
  return { open };
}
