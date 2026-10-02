/** Pure: shorten text at a word boundary for meta descriptions. */
export function clip(text: string, max = 158): string {
  const t = text.split(/\s+/).filter(Boolean).join(" ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const i = cut.lastIndexOf(" ");
  return (i > 0 ? cut.slice(0, i) : cut) + "…";
}
