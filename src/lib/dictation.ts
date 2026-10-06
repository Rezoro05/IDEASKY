/** Dictation into the idea field: how spoken words join what is already typed. Pure. */

/** What the speech recognizer has heard so far in one session: the settled words, then the words it is still unsure of. */
export type Heard = { readonly final: string; readonly interim: string };

const SENTENCE_END = /[.!?]\s*$/;

/** The field's text while dictating: what was typed before, then what was said, one space between, never past the limit.
 *  Spoken text starts with a capital when it begins the field or a new sentence. */
export function dictatedText(before: string, heard: Heard, limit: number): string {
  const spoken = `${heard.final} ${heard.interim}`.replace(/\s+/g, " ").trim();
  if (!spoken) return before.slice(0, limit);
  const head = before.replace(/\s+$/, "");
  const startsSentence = head === "" || SENTENCE_END.test(head);
  const said = startsSentence ? spoken.charAt(0).toUpperCase() + spoken.slice(1) : spoken;
  return (head ? `${head} ${said}` : said).slice(0, limit);
}
