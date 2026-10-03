/** "+ Add link" rows inside a form: add up to five, remove any, read what was typed. Blank rows are ignored by the rules. */
import { LINK_LIMITS, type LinkRow } from "../lib/links";

export type LinkRows = { typed(): LinkRow[]; clear(): void; focusRow(index: number): void };

export function linkRowsIn(container: HTMLElement): LinkRows {
  const list = container.querySelector<HTMLOListElement>(".link-rows")!, add = container.querySelector<HTMLButtonElement>(".add-link")!;
  const template = container.querySelector<HTMLTemplateElement>("template")!;
  const rows = () => [...list.querySelectorAll<HTMLLIElement>(".link-row")];
  const showAdd = () => { add.hidden = rows().length >= LINK_LIMITS.perIdea; };

  add.addEventListener("click", () => {
    list.append(template.content.cloneNode(true));
    showAdd();
    rows().at(-1)!.querySelector<HTMLInputElement>(".link-url")!.focus();
  });
  list.addEventListener("click", (e) => {
    const row = (e.target as Element).closest(".link-remove")?.closest(".link-row");
    if (!row) return;
    row.remove(); showAdd(); add.focus();
    container.dispatchEvent(new Event("input", { bubbles: true })); // removing a row is an edit too
  });

  return {
    typed: () => rows().map((row) => ({
      url: row.querySelector<HTMLInputElement>(".link-url")!.value, title: row.querySelector<HTMLInputElement>(".link-title")!.value,
    })),
    clear() { list.replaceChildren(); showAdd(); },
    focusRow: (i) => rows()[i]?.querySelector<HTMLInputElement>(".link-url")?.focus(),
  };
}
