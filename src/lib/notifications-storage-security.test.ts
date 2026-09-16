import { afterEach, describe, expect, it } from "bun:test";

import { getNotifications, leereAlle, pushNotification } from "@/lib/notifications";

describe("Benachrichtigungen: Browser-Speicher-Sicherheit", () => {
  afterEach(() => leereAlle());

  it("persistiert Patientendaten weder in localStorage noch sessionStorage", () => {
    const originalWindow = globalThis.window;
    let storageCalls = 0;
    const storage = {
      getItem: () => {
        storageCalls += 1;
        return null;
      },
      setItem: () => {
        storageCalls += 1;
      },
      removeItem: () => {
        storageCalls += 1;
      },
      clear: () => {
        storageCalls += 1;
      },
      key: () => null,
      length: 0,
    } as Storage;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage, sessionStorage: storage },
    });
    try {
      pushNotification({
        id: "synthetic-patient-warning",
        stufe: "kritisch",
        titel: "Nicht zugewiesen: TEST-1 · Erika Testpatientin",
        text: "Synthetische Testbenachrichtigung",
        to: "/auftraege",
        quelle: "auftrag:synthetic-1",
      });
      expect(getNotifications().some((item) => item.id === "synthetic-patient-warning")).toBe(true);
      expect(storageCalls).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
