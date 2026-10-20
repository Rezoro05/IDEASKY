/** The owner's email for something new: an idea, a dream or a comment on the public board, or a feedback note. Pure and import-free, so it is tested without Deno.
 *  The database sends the record (supabase/migrations/20261001000013_owner_alerts.sql); anything that isn't one of those shapes gets no email. */
export type Alert = { subject: string; text: string; replyTo?: string };
/** An email to someone other than the owner: the author of a post that was just answered. */
export type PosterAlert = Alert & { to: string };

const ID = /^[a-z0-9]{6,20}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** `site` is the public page's address (…/IDEASKY/); a link to one idea is `site#idea-<id>`, as on the site itself. */
export function alertFor(body: unknown, site: string): Alert | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const type = b.type, id = str(b.id, 20), name = str(b.name, 40) || "Anonymous", message = str(b.message, 600);
  if (!ID.test(id) || !message) return null;
  const link = (ideaId: string) => `${site.split("#")[0]}#idea-${ideaId}`;
  if (type === "idea" || type === "dream") {
    const email = str(b.email, 254), links = Array.isArray(b.links) ? b.links.slice(0, 5) : [];
    const lines = [message, ""];
    for (const l of links) {
      const url = l && typeof l === "object" ? str((l as Record<string, unknown>).url, 500) : "";
      if (/^https?:\/\//.test(url)) lines.push(`Link: ${url}`);
    }
    lines.push(`From: ${name}${EMAIL.test(email) ? ` <${email}>` : ""}`, `Open it: ${link(id)}`);
    return {
      subject: type === "dream" ? `New dream in the Sea of Dreams from ${name}` : `New idea on Sky of Ideas from ${name}`,
      text: lines.join("\n"),
      ...(EMAIL.test(email) ? { replyTo: email } : {}),
    };
  }
  if (type === "feedback") {
    const email = str(b.email, 254), page = str(b.page, 300);
    return {
      subject: "Feedback on Sky of Ideas",
      text: [message, "", `From: ${EMAIL.test(email) ? email : "someone who left no email"}`, ...(page ? [`Page: ${page}`] : [])].join("\n"),
      ...(EMAIL.test(email) ? { replyTo: email } : {}),
    };
  }
  if (type === "comment") {
    const ideaId = str(b.idea_id, 20);
    if (!ID.test(ideaId)) return null;
    const on = str(b.idea_name, 40) || "Anonymous";
    return { subject: `New comment from ${name} on ${on}'s post`, text: [message, "", `From: ${name}`, `Open it: ${link(ideaId)}`].join("\n") };
  }
  return null;
}

/** The post's author hears that someone answered, when the post has an address (the email they left, or their account's).
 *  Never to the owner's own address (they already get the owner's alert). */
export function posterAlertFor(body: unknown, site: string, ownerAddress: string): PosterAlert | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const to = str(b.poster_email, 254), id = str(b.id, 20), ideaId = str(b.idea_id, 20), message = str(b.message, 600);
  if (b.type !== "comment" || !EMAIL.test(to) || !ID.test(id) || !ID.test(ideaId) || !message) return null;
  if (to.toLowerCase() === ownerAddress.trim().toLowerCase()) return null;
  const name = str(b.name, 40) || "Someone", what = b.idea_kind === "dream" ? "dream" : "idea";
  return {
    to,
    subject: `${name} answered your ${what} on Sky of Ideas`,
    text: [`${name} wrote:`, "", message, "", `See it: ${site.split("#")[0]}#idea-${ideaId}`, "",
      `You're getting this because you left this address with your ${what}, or posted it while signed in.`].join("\n"),
  };
}
