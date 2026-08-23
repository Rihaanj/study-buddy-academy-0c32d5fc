export type SavedAccount = { first: string; last: string; last_used: number };

const KEY = "sb_saved_accounts";

const read = (): SavedAccount[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedAccount[]) : [];
    return Array.isArray(list) ? list.filter((a) => a?.first && a?.last) : [];
  } catch {
    return [];
  }
};

export const getSavedAccounts = (): SavedAccount[] =>
  read().sort((a, b) => (b.last_used ?? 0) - (a.last_used ?? 0)).slice(0, 5);

export const rememberAccount = (first: string, last: string) => {
  const f = first.trim();
  const l = last.trim();
  if (!f || !l) return;
  const key = `${f.toLowerCase()} ${l.toLowerCase()}`;
  const next = [
    { first: f, last: l, last_used: Date.now() },
    ...read().filter((a) => `${a.first.toLowerCase()} ${a.last.toLowerCase()}` !== key),
  ].slice(0, 5);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — remembering is best-effort */
  }
};

export const forgetAccount = (first: string, last: string) => {
  const key = `${first.toLowerCase()} ${last.toLowerCase()}`;
  const next = read().filter((a) => `${a.first.toLowerCase()} ${a.last.toLowerCase()}` !== key);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
};
