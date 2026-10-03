/** The short status message at the bottom of the page. */
import { byId } from "./dom";

const TOAST_MS = 6000;

export function startToast(): (text: string) => void {
  const toast = byId("toast");
  let timer = 0;
  return (text) => {
    toast.textContent = text; toast.hidden = false;
    clearTimeout(timer);
    timer = window.setTimeout(() => { toast.hidden = true; }, TOAST_MS);
  };
}
