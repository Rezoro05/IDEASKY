/** The owner's email for something new on the public board: an idea, a dream or a comment. Pure and import-free, so it is tested without Deno.
 *  The database sends the record (supabase/migrations/20261001000013_owner_alerts.sql); anything that isn't one of those shapes gets no email. */
export type Alert = { subject: string; text: string; replyTo?: string };

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
  if (type === "comment") {
    const ideaId = str(b.idea_id, 20);
    if (!ID.test(ideaId)) return null;
    const on = str(b.idea_name, 40) || "Anonymous";
    return { subject: `New comment from ${name} on ${on}'s post`, text: [message, "", `From: ${name}`, `Open it: ${link(ideaId)}`].join("\n") };
  }
  return null;
}
