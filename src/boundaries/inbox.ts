/** Every idea and comment is also emailed to the platform owner through Formspree, and feedback goes only there. A visitor's email is used only there, never shown. */
import type { Idea } from "../lib/ideas";
import type { Comment } from "../lib/comments";
import type { Feedback } from "../lib/feedback";

export interface Inbox {
  /** False when no inbox is set up (local runs): nothing can be emailed, so callers that depend on it must say so. */
  readonly configured: boolean;
  send(idea: Idea, email: string, page: string): Promise<boolean>;
  sendComment(comment: Comment, ideaName: string, page: string): Promise<boolean>;
  sendFeedback(feedback: Feedback, page: string): Promise<boolean>;
}

export function inboxFields(idea: Idea, email: string, page: string): [string, string][] {
  return [
    ["name", idea.name],
    ...(email ? [["email", email] as [string, string]] : []),
    ["message", idea.message],
    ["idea_id", idea.id],
    ["page", page],
    ["_subject", idea.kind === "dream" ? `New dream in the Sea of Dreams from ${idea.name}` : `New idea on IDEA SKY from ${idea.name}`],
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

export function feedbackFields(f: Feedback, page: string): [string, string][] {
  return [
    ...(f.email ? [["email", f.email] as [string, string]] : []),
    ["message", f.message],
    ["page", page],
    ["_subject", "Feedback on IDEA SKY"],
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
    configured: true,
    send: (idea, email, page) => post(inboxFields(idea, email, page)),
    sendComment: (c, ideaName, page) => post(commentFields(c, ideaName, page)),
    sendFeedback: (f, page) => post(feedbackFields(f, page)),
  };
}

/** No inbox configured (local runs): nothing is sent, and nothing pretends it was. */
export const unconfiguredInbox: Inbox = {
  configured: false,
  send: async () => false,
  sendComment: async () => false,
  sendFeedback: async () => false,
};

export const inboxFor = (endpoint: string, doFetch: typeof fetch): Inbox =>
  endpoint ? formspreeInbox(endpoint, doFetch) : unconfiguredInbox;
