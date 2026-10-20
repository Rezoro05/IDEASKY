/** Supabase Edge Function `notify`: emails the site's owner about something new on the public board, through Resend.
 *  Called only by the database (supabase/migrations/20261001000013_owner_alerts.sql, after each new idea, dream or comment), with a shared secret in
 *  `x-notify-secret`; anything else is refused. Secrets: NOTIFY_SECRET (the same value as the database vault's `notify_secret`),
 *  RESEND_API_KEY, NOTIFY_TO (the owner's address); optional NOTIFY_FROM (default Resend's test sender) and SITE_URL.
 *  Deployed with Verify JWT off (config.toml): the database calls it without a sign-in. */
import { alertFor } from "../_shared/alert.ts";

const env = (name: string): string => Deno.env.get(name) ?? "";

/** Same length and same bytes, compared without stopping early. */
function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (!sameSecret(env("NOTIFY_SECRET"), req.headers.get("x-notify-secret") ?? "")) return new Response(null, { status: 401 });
  let body: unknown = null;
  try { body = await req.json(); } catch { /* refused below */ }
  const alert = alertFor(body, env("SITE_URL") || "https://rezoro05.github.io/IDEASKY/");
  if (!alert) return new Response(null, { status: 400 });
  if (!env("RESEND_API_KEY") || !env("NOTIFY_TO")) { console.error("RESEND_API_KEY or NOTIFY_TO is not set: no email sent"); return new Response(null, { status: 503 }); }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("NOTIFY_FROM") || "Sky of Ideas <onboarding@resend.dev>",
        to: [env("NOTIFY_TO")], subject: alert.subject, text: alert.text,
        ...(alert.replyTo ? { reply_to: alert.replyTo } : {}),
      }),
    });
    if (!r.ok) { console.error(`sending the email failed: ${r.status} ${(await r.text()).slice(0, 300)}`); return new Response(null, { status: 502 }); }
    return new Response(null, { status: 204 });
  } catch (e) { console.error(`sending the email failed: ${e}`); return new Response(null, { status: 502 }); }
});
