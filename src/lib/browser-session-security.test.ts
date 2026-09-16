import { describe, expect, it } from "bun:test";

import {
  DAUERAUFTRAG_ENTWURF_PREFIX,
  clearSensitiveGhasiSession,
  transitionSensitiveBrowserUser,
} from "@/lib/browser-session-security";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const draftKey = `${DAUERAUFTRAG_ENTWURF_PREFIX}neu`;

describe("sensible Browser-Sitzung bei Benutzerwechsel", () => {
  it("beseitigt alte unzugeordnete Entwuerfe beim ersten Login", () => {
    const store = new MemoryStorage();
    store.setItem(draftKey, "patient-a");
    store.setItem("ghasi-theme", "dark");

    const result = transitionSensitiveBrowserUser("user-a", store as unknown as Storage);
    expect(result).toEqual({ changed: true, clearedKeys: 1 });
    expect(store.getItem(draftKey)).toBeNull();
    expect(store.getItem("ghasi-theme")).toBe("dark");
  });

  it("bewahrt Entwuerfe bei Reload desselben Benutzers", () => {
    const store = new MemoryStorage();
    transitionSensitiveBrowserUser("user-a", store as unknown as Storage);
    store.setItem(draftKey, "patient-a");

    expect(transitionSensitiveBrowserUser("user-a", store as unknown as Storage)).toEqual({
      changed: false,
      clearedKeys: 0,
    });
    expect(store.getItem(draftKey)).toBe("patient-a");
  });

  it("loescht Entwuerfe bei Benutzerwechsel und Logout", () => {
    const store = new MemoryStorage();
    transitionSensitiveBrowserUser("user-a", store as unknown as Storage);
    store.setItem(draftKey, "patient-a");
    expect(transitionSensitiveBrowserUser("user-b", store as unknown as Storage).clearedKeys).toBe(
      1,
    );
    store.setItem(draftKey, "patient-b");
    expect(transitionSensitiveBrowserUser(null, store as unknown as Storage).clearedKeys).toBe(1);
    expect(store.getItem(draftKey)).toBeNull();
  });

  it("loescht ausschliesslich sensible GHASI-Sitzungsschluessel", () => {
    const store = new MemoryStorage();
    store.setItem(draftKey, "patient-a");
    store.setItem("unrelated", "keep");
    expect(clearSensitiveGhasiSession(store as unknown as Storage)).toBe(1);
    expect(store.getItem("unrelated")).toBe("keep");
  });
});
