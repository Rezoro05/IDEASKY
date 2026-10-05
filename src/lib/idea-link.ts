/** Pure: a link to one idea is the page's address with `#idea-<id>`; opening such a link opens that idea. */
const PREFIX = "#idea-";
const ID = /^[a-z0-9]{6,20}$/; // the same shape the board accepts for an idea id

export const ideaLink = (pageUrl: string, id: string): string => pageUrl.split("#")[0] + PREFIX + id;

/** The idea a link points at (from its # part), or null if it doesn't point at one. */
export function linkedIdeaId(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null;
  const id = hash.slice(PREFIX.length);
  return ID.test(id) ? id : null;
}
