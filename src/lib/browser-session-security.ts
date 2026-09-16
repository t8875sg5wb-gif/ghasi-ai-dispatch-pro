export const DAUERAUFTRAG_ENTWURF_PREFIX = "ghasi:dauerauftrag-entwurf:";
const USER_MARKER = "ghasi:sensitive-session-user";

type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

function browserSessionStore(): SessionStore | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function clearSensitiveGhasiSession(
  store: SessionStore | null = browserSessionStore(),
): number {
  if (!store) return 0;
  const keys: string[] = [];
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(DAUERAUFTRAG_ENTWURF_PREFIX)) keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
    return keys.length;
  } catch {
    return 0;
  }
}
export interface BrowserSessionTransition {
  changed: boolean;
  clearedKeys: number;
}

export function transitionSensitiveBrowserUser(
  nextUserId: string | null,
  store: SessionStore | null = browserSessionStore(),
): BrowserSessionTransition {
  if (!store) return { changed: false, clearedKeys: 0 };
  try {
    const previousUserId = store.getItem(USER_MARKER);
    if (nextUserId && previousUserId === nextUserId) {
      return { changed: false, clearedKeys: 0 };
    }

    const clearedKeys = clearSensitiveGhasiSession(store);
    if (nextUserId) store.setItem(USER_MARKER, nextUserId);
    else store.removeItem(USER_MARKER);
    return { changed: previousUserId !== nextUserId || clearedKeys > 0, clearedKeys };
  } catch {
    // Blockierter Session-Speicher ist selbst nicht lesbar; der Auth-Wechsel darf nicht hängen.
    return { changed: false, clearedKeys: 0 };
  }
}
