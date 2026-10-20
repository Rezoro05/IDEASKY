/** Feedback notes for the site's owner. They are saved in the board's `feedback` table, which visitors can add to but never read;
 *  the database then emails the owner (supabase/functions/notify). With no board set up (local runs) nothing is sent, and nothing pretends it was. */
import type { Feedback } from "../lib/feedback";
import { newRecordId, usableEmail } from "../lib/ideas";
import { supabaseHeaders } from "./ideaStore";

export interface FeedbackStore {
  /** False when there is no board to send to: the note says so instead of pretending. */
  readonly configured: boolean;
  send(feedback: Feedback, page: string): Promise<boolean>;
}

export function supabaseFeedback(d: { url: string; key: string; fetch: typeof fetch; randomBytes: (n: number) => Uint8Array }): FeedbackStore {
  return {
    configured: true,
    async send(f, page) {
      try {
        const email = usableEmail(f.email); // an unusable address is dropped, never a reason to lose the note
        const r = await d.fetch(d.url + "/rest/v1/feedback", {
          method: "POST", headers: { ...supabaseHeaders(d.key), Prefer: "return=minimal" },
          body: JSON.stringify({ id: newRecordId(d.randomBytes(8)), message: f.message, ...(email ? { email } : {}), page: page.slice(0, 300) }),
        });
        return r.ok;
      } catch { return false; }
    },
  };
}

export const unconfiguredFeedback: FeedbackStore = { configured: false, send: async () => false };
