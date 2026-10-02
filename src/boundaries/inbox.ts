/** Every Idea Note is also emailed to Rez through Formspree. The visitor's email is used only there, never shown. */
import type { Note } from "../lib/notes";
import type { Comment } from "../lib/comments";

export interface Inbox {
  send(note: Note, email: string, page: string): Promise<boolean>;
  sendComment(comment: Comment, ideaName: string, page: string): Promise<boolean>;
}

export function inboxFields(note: Note, email: string, page: string): [string, string][] {
  return [
    ["name", note.name],
    ...(email ? [["email", email] as [string, string]] : []),
    ["message", note.message],
    ["idea_id", note.id],
    ["page", page],
    ["_subject", `New idea on your site from ${note.name}`],
  ];
}

export function commentFields(c: Comment, ideaName: string, page: string): [string, string][] {
  return [
    ["name", c.name],
    ["message", c.message],
    ["comment_on", ideaName],
    ["idea_id", c.ideaId],
    ["comment_id", c.id],
    ["page", page],
    ["_subject", `New comment on ${ideaName} from ${c.name}`],
  ];
}

export function formspreeInbox(endpoint: string, doFetch: typeof fetch): Inbox {
  async function post(fields: [string, string][]): Promise<boolean> {
    try {
      const fd = new FormData();
      for (const [k, val] of fields) fd.append(k, val);
      const r = await doFetch(endpoint, { method: "POST", body: fd, headers: { Accept: "application/json" } });
      return r.ok;
    } catch { return false; }
  }
  return {
    send: (note, email, page) => post(inboxFields(note, email, page)),
    sendComment: (c, ideaName, page) => post(commentFields(c, ideaName, page)),
  };
}
