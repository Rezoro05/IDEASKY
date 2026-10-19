import { describe, it, expect } from "vitest";
import { authReturn, checkEmail, initialOf, needsRenewal, parseSession, returnAddress, sessionFrom, tokenClaims, RENEW_BEFORE_MS } from "../../src/lib/account";
import { memoryAuth, supabaseAuth, SESSION_ITEM } from "../../src/boundaries/auth";

/** A token shaped like Supabase's (header.claims.signature); the signature isn't checked here. */
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims: Record<string, unknown>) => `${b64({ alg: "HS256" })}.${b64(claims)}.sig`;
const TOKEN = jwt({ sub: "user-1", email: "rez@example.com", exp: 2_000_000_000 });

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } };
}
type Call = { url: string; init: RequestInit };
function fakeFetch(answer: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return answer(url, init); }) as unknown as typeof fetch;
  return { f, calls };
}

describe("account rules", () => {
  it("checks an email: trims and lower-cases it, and says what is wrong", () => {
    expect(checkEmail("  Rez@Example.COM ")).toEqual({ ok: true, email: "rez@example.com" });
    expect(checkEmail("")).toEqual({ ok: false, text: "Type your email first." });
    expect(checkEmail("rez@example").ok).toBe(false);
    expect(checkEmail("rez example.com").ok).toBe(false);
  });
  it("reads a sign-in link's return, and leaves the site's own #parts alone", () => {
    expect(authReturn("#access_token=a.b.c&refresh_token=r1&expires_in=3600&token_type=bearer&type=magiclink"))
      .toEqual({ kind: "tokens", tokens: { accessToken: "a.b.c", refreshToken: "r1", expiresIn: 3600 } });
    expect(authReturn("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid")).toEqual({ kind: "error", text: "That sign-in link has expired or was already used. Ask for a new one." });
    expect(authReturn("#error=server_error")?.kind).toBe("error");
    for (const ours of ["", "#sea", "#studio", "#idea-abc"]) expect(authReturn(ours)).toBeNull();
  });
  it("reads who is signed in from the token, and nothing from a broken one", () => {
    expect(tokenClaims(TOKEN)).toEqual({ sub: "user-1", email: "rez@example.com", exp: 2_000_000_000 });
    expect(tokenClaims(jwt({ sub: "u", email: "ре@пример.рф" }))?.email).toBe("ре@пример.рф");
    expect(tokenClaims("nope")).toBeNull();
    expect(tokenClaims("a.!!!.c")).toBeNull();
  });
  it("a session runs out at its expiry, and is renewed a minute before", () => {
    const s = sessionFrom({ accessToken: TOKEN, refreshToken: "r", expiresIn: 3600 }, 1000)!;
    expect(s).toEqual({ accessToken: TOKEN, refreshToken: "r", expiresAt: 1000 + 3_600_000, user: { id: "user-1", email: "rez@example.com" } });
    expect(needsRenewal(s, s.expiresAt - RENEW_BEFORE_MS - 1)).toBe(false);
    expect(needsRenewal(s, s.expiresAt - RENEW_BEFORE_MS)).toBe(true);
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseSession({ accessToken: 1 })).toBeNull();
    expect(parseSession(null)).toBeNull();
  });
  it("the initial and the address to come back to", () => {
    expect(initialOf("rez@example.com")).toBe("R");
    expect(initialOf("_9lives@x.io")).toBe("9");
    expect(returnAddress("https://rezoro05.github.io/IDEASKY/?x=1#sea")).toBe("https://rezoro05.github.io/IDEASKY/");
  });
});

describe("Supabase sign-in", () => {
  const opts = (f: typeof fetch, storage = memoryStorage(), now = () => 1000) => ({ url: "https://board.test", key: "pk", fetch: f, storage, now });

  it("sends a link that comes back to the page, and says why it couldn't", async () => {
    const { f, calls } = fakeFetch(() => new Response("{}", { status: 200 }));
    expect(await supabaseAuth(opts(f)).sendLink("rez@example.com", "https://site.test/IDEASKY/")).toBe("sent");
    expect(calls[0]!.url).toBe("https://board.test/auth/v1/otp?redirect_to=https%3A%2F%2Fsite.test%2FIDEASKY%2F");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ email: "rez@example.com", create_user: true });
    expect((calls[0]!.init.headers as Record<string, string>).apikey).toBe("pk");
    for (const [status, result] of [[429, "too-many"], [422, "invalid"], [500, "failed"]] as const) {
      expect(await supabaseAuth(opts(fakeFetch(() => new Response("", { status })).f)).sendLink("a@b.co", "x")).toBe(result);
    }
    expect(await supabaseAuth(opts(fakeFetch(() => { throw new Error("offline"); }).f)).sendLink("a@b.co", "x")).toBe("failed");
  });

  it("takes the returned session, keeps it in the browser, and tells listeners", () => {
    const storage = memoryStorage(), seen: (string | null)[] = [];
    const auth = supabaseAuth(opts(fakeFetch(() => new Response("")).f, storage));
    auth.onChange((u) => seen.push(u?.email ?? null));
    expect(auth.accept({ accessToken: TOKEN, refreshToken: "r", expiresIn: 3600 })).toBe(true);
    expect(seen).toEqual([null, "rez@example.com"]);
    expect(supabaseAuth(opts(fakeFetch(() => new Response("")).f, storage)).user()?.email).toBe("rez@example.com"); // a reload remembers
    expect(auth.accept({ accessToken: "broken", refreshToken: "r", expiresIn: 3600 })).toBe(false);
  });

  it("renews the token once before it runs out, however many ask at the same moment", async () => {
    let t = 1000;
    const newer = jwt({ sub: "user-1", email: "rez@example.com" });
    const { f, calls } = fakeFetch(() => new Response(JSON.stringify({ access_token: newer, refresh_token: "r2", expires_in: 3600 })));
    const auth = supabaseAuth(opts(f, memoryStorage(), () => t));
    auth.accept({ accessToken: TOKEN, refreshToken: "r", expiresIn: 3600 });
    expect(await auth.token()).toBe(TOKEN);
    expect(calls).toHaveLength(0);
    t += 3_600_000;
    const [a, b] = await Promise.all([auth.token(), auth.token()]);
    expect([a, b]).toEqual([newer, newer]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://board.test/auth/v1/token?grant_type=refresh_token");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ refresh_token: "r" });
  });

  it("a session ended elsewhere signs out here; a network hiccup does not", async () => {
    let t = 1000, status = 503;
    const auth = supabaseAuth(opts(fakeFetch(() => new Response("", { status })).f, memoryStorage(), () => t));
    auth.accept({ accessToken: TOKEN, refreshToken: "r", expiresIn: 3600 });
    t += 3_600_000;
    expect(await auth.token()).toBe(TOKEN); // kept for now, renewed next time
    status = 400;
    expect(await auth.token()).toBeNull();
    expect(auth.user()).toBeNull();
  });

  it("signs out here at once, tells the server, and forgets the session", async () => {
    const storage = memoryStorage();
    const { f, calls } = fakeFetch(() => { throw new Error("offline"); });
    const auth = supabaseAuth(opts(f, storage));
    auth.accept({ accessToken: TOKEN, refreshToken: "r", expiresIn: 3600 });
    await auth.signOut();
    expect(auth.user()).toBeNull();
    expect(storage.getItem(SESSION_ITEM)).toBeNull();
    expect(calls[0]!.url).toBe("https://board.test/auth/v1/logout");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("Google: on only when the service says so; the trip goes to the service's Google sign-in and back here", async () => {
    const on = fakeFetch(() => new Response(JSON.stringify({ external: { email: true, google: true } })));
    expect(await supabaseAuth(opts(on.f)).google()).toBe(true);
    expect(on.calls[0]!.url).toBe("https://board.test/auth/v1/settings");
    expect(await supabaseAuth(opts(fakeFetch(() => new Response(JSON.stringify({ external: { google: false } }))).f)).google()).toBe(false);
    expect(await supabaseAuth(opts(fakeFetch(() => new Response("", { status: 500 })).f)).google()).toBe(false);
    expect(await supabaseAuth(opts(fakeFetch(() => { throw new Error("offline"); }).f)).google()).toBe(false);
    expect(await supabaseAuth(opts(on.f)).withGoogle("https://site.test/IDEASKY/")).toEqual({ go: "https://board.test/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fsite.test%2FIDEASKY%2F" });
  });

  it("a broken stored session is ignored", () => {
    const storage = memoryStorage();
    storage.setItem(SESSION_ITEM, "{not json");
    expect(supabaseAuth(opts(fakeFetch(() => new Response("")).f, storage)).user()).toBeNull();
  });
});

describe("pretend sign-in (no service)", () => {
  it("signs in at once as the email given, and out again", async () => {
    const auth = memoryAuth(), seen: (string | null)[] = [];
    auth.onChange((u) => seen.push(u?.email ?? null));
    expect(await auth.sendLink("rez@example.com", "x")).toBe("signed-in");
    expect(await auth.token()).toBe("local");
    await auth.signOut();
    expect(seen).toEqual([null, "rez@example.com", null]);
    expect(await auth.token()).toBeNull();
    expect(await auth.google()).toBe(true);
    expect(await auth.withGoogle("x")).toBe("signed-in");
    expect(auth.user()?.email).toBe("you@gmail.com");
  });
});
