/** Delete keys for ideas this browser posted. Only a hash of each key lives in the database. */
export interface KeyStore {
  get(id: string): string | undefined;
  set(id: string, key: string): void;
  drop(id: string): void;
}

export const DELETE_KEYS_ITEM = "idea-delete-keys";
export const COMMENT_KEYS_ITEM = "comment-delete-keys";

/** Storage can be missing or throw (private mode, blocked site data): every call is safe. */
export function browserKeyStore(storage: Pick<Storage, "getItem" | "setItem"> | null, item: string = DELETE_KEYS_ITEM): KeyStore {
  const read = (): Record<string, string> => {
    try { return JSON.parse(storage?.getItem(item) || "{}") as Record<string, string>; } catch { return {}; }
  };
  const write = (k: Record<string, string>) => { try { storage?.setItem(item, JSON.stringify(k)); } catch { /* not saved */ } };
  return {
    get: (id) => read()[id],
    set: (id, key) => { const k = read(); k[id] = key; write(k); },
    drop: (id) => { const k = read(); delete k[id]; write(k); },
  };
}
