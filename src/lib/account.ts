/** Accounts, as pure rules: an email to send a sign-in link to, the session a link brings back, and when to renew it.
 *  The sign-in link (Supabase Auth, magic link) returns to the site with the session in the address: #access_token=…&refresh_token=…
 *  or, when it has expired or was used, #error=…&error_description=…. Nothing here talks to the network or the page. */

export type User = { readonly id: string; readonly email: string };
export type Session = { readonly accessToken: string; readonly refreshToken: string; /** ms since 1970 */ readonly expiresAt: number; readonly user: User };
export type Tokens = { readonly accessToken: string; readonly refreshToken: string; /** seconds */ readonly expiresIn: number };

export const EMAIL_MAX = 254;

export type EmailCheck = { ok: true; email: string } | { ok: false; text: string };
/** A plausible address, trimmed and lower-cased. The real check is the email arriving. */
export function checkEmail(input: string): EmailCheck {
  const email = input.trim().toLowerCase();
  if (!email) return { ok: false, text: "Type your email first." };
  if (email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, text: "That doesn’t look like an email address." };
  return { ok: true, email };
}

export type AuthReturn = { kind: "tokens"; tokens: Tokens } | { kind: "error"; text: string } | null;
/** What a sign-in link brought back in the address's #part, if anything. Other #parts (#sea, #idea-…, #studio) are not ours: null. */
export function authReturn(hash: string): AuthReturn {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.has("error") || params.has("error_code")) {
    const code = params.get("error_code") ?? "";
    return { kind: "error", text: code === "otp_expired" ? "That sign-in link has expired or was already used. Ask for a new one." : "That sign-in link didn’t work. Ask for a new one." };
  }
  const accessToken = params.get("access_token"), refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  const expiresIn = Number(params.get("expires_in"));
  return { kind: "tokens", tokens: { accessToken, refreshToken, expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600 } };
}

/** The claims inside an access token (a JWT), read without checking its signature: only for showing who is signed in.
 *  The database checks the signature on every request. */
export function tokenClaims(token: string): { sub: string; email: string; exp: number } | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const bytes = Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return typeof json.sub === "string" ? { sub: json.sub, email: typeof json.email === "string" ? json.email : "", exp: Number(json.exp) || 0 } : null;
  } catch { return null; }
}

export function sessionFrom(tokens: Tokens, now: number): Session | null {
  const claims = tokenClaims(tokens.accessToken);
  if (!claims) return null;
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: now + tokens.expiresIn * 1000, user: { id: claims.sub, email: claims.email } };
}

/** A session is renewed a minute before it runs out, so a request never goes out with a token about to expire. */
export const RENEW_BEFORE_MS = 60_000;
export const needsRenewal = (session: Session, now: number): boolean => now >= session.expiresAt - RENEW_BEFORE_MS;

/** A stored session, if it is one (storage can hold anything). */
export function parseSession(value: unknown): Session | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>, u = s.user as Record<string, unknown> | undefined;
  if (typeof s.accessToken !== "string" || typeof s.refreshToken !== "string" || typeof s.expiresAt !== "number" || !u || typeof u.id !== "string" || typeof u.email !== "string") return null;
  return { accessToken: s.accessToken, refreshToken: s.refreshToken, expiresAt: s.expiresAt, user: { id: u.id, email: u.email } };
}

/** The letter in the account button: the email's first letter or digit. */
export const initialOf = (email: string): string => (email.match(/[a-z0-9]/i)?.[0] ?? "?").toUpperCase();

/** Where a sign-in link should bring the visitor back: this page, without any #part or query. */
export const returnAddress = (href: string): string => { const u = new URL(href); return u.origin + u.pathname; };
