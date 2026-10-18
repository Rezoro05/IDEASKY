/** Sign-in, behind a small interface: Supabase Auth over plain fetch (email magic link), or in memory for previews and tests.
 *  Keeps the session in the browser and renews it before it runs out. Never throws: every failure comes back as a value the page can say. */
import { needsRenewal, parseSession, sessionFrom, type Session, type Tokens, type User } from "../lib/account";

export type SendResult = "sent" | "signed-in" | "invalid" | "too-many" | "failed";

export interface Auth {
  /** The signed-in user right now, or null. */
  user(): User | null;
  /** Hears every sign-in and sign-out (and is told the current state at once). */
  onChange(fn: (user: User | null) => void): void;
  /** Email a sign-in link that brings the visitor back to `returnTo`. In memory: signs in at once ("signed-in"). */
  sendLink(email: string, returnTo: string): Promise<SendResult>;
  /** Take the session a sign-in link brought back. False if it isn't usable. */
  accept(tokens: Tokens): boolean;
  /** A fresh access token for a request (renewed first if it is about to run out), or null when signed out. */
  token(): Promise<string | null>;
  signOut(): Promise<void>;
}

export const SESSION_ITEM = "skyofideas.session";

type Listener = (user: User | null) => void;

function listeners() {
  const all: Listener[] = [];
  return { add(fn: Listener, now: User | null) { all.push(fn); fn(now); }, tell(user: User | null) { for (const fn of all) fn(user); } };
}

export function supabaseAuth(opts: { url: string; key: string; fetch: typeof fetch; storage: Storage | null; now?: () => number }): Auth {
  const now = opts.now ?? Date.now;
  const heard = listeners();
  let session: Session | null = null;
  try { session = parseSession(JSON.parse(opts.storage?.getItem(SESSION_ITEM) ?? "null")); } catch { session = null; }
  let renewing: Promise<Session | null> | null = null;

  function keep(next: Session | null): void {
    const changed = (session?.user.id ?? null) !== (next?.user.id ?? null);
    session = next;
    try { if (next) opts.storage?.setItem(SESSION_ITEM, JSON.stringify(next)); else opts.storage?.removeItem(SESSION_ITEM); } catch { /* private mode: lasts this visit */ }
    if (changed) heard.tell(next?.user ?? null);
  }
  const headers = (extra: Record<string, string> = {}) => ({ apikey: opts.key, "Content-Type": "application/json", ...extra });

  async function renew(old: Session): Promise<Session | null> {
    try {
      const res = await opts.fetch(`${opts.url}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: headers(), body: JSON.stringify({ refresh_token: old.refreshToken }) });
      if (res.status === 400 || res.status === 401 || res.status === 403) { keep(null); return null; } // the session was ended elsewhere: signed out
      if (!res.ok) return old; // a hiccup: keep what we have and try again next time
      const body = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
      if (!body.access_token || !body.refresh_token) return old;
      const next = sessionFrom({ accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in ?? 3600 }, now());
      keep(next);
      return next;
    } catch { return old; }
  }

  return {
    user: () => session?.user ?? null,
    onChange: (fn) => heard.add(fn, session?.user ?? null),
    async sendLink(email, returnTo) {
      try {
        const res = await opts.fetch(`${opts.url}/auth/v1/otp?redirect_to=${encodeURIComponent(returnTo)}`, { method: "POST", headers: headers(), body: JSON.stringify({ email, create_user: true }) });
        if (res.ok) return "sent";
        if (res.status === 429) return "too-many";
        if (res.status === 400 || res.status === 422) return "invalid";
        return "failed";
      } catch { return "failed"; }
    },
    accept(tokens) {
      const next = sessionFrom(tokens, now());
      if (!next) return false;
      keep(next);
      return true;
    },
    async token() {
      if (!session) return null;
      if (!needsRenewal(session, now())) return session.accessToken;
      renewing ??= renew(session).finally(() => { renewing = null; }); // one renewal at a time, however many requests ask
      return (await renewing)?.accessToken ?? null;
    },
    async signOut() {
      const old = session;
      keep(null); // signed out here at once, whatever the server says
      if (!old) return;
      try { await opts.fetch(`${opts.url}/auth/v1/logout`, { method: "POST", headers: headers({ Authorization: `Bearer ${old.accessToken}` }) }); } catch { /* the token runs out on its own */ }
    },
  };
}

/** No sign-in service (local runs, the preview): sending a link signs in at once, as that email. Lasts the visit. */
export function memoryAuth(start: User | null = null): Auth {
  const heard = listeners();
  let user = start;
  const set = (next: User | null) => { user = next; heard.tell(next); };
  return {
    user: () => user,
    onChange: (fn) => heard.add(fn, user),
    async sendLink(email) { set({ id: `local-${email}`, email }); return "signed-in"; },
    accept: () => false,
    token: async () => (user ? "local" : null),
    async signOut() { set(null); },
  };
}
