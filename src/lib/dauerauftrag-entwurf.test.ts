import { describe, expect, it } from "vitest";

import {
  ENTWURF_MAX_ALTER_MS,
  entwurfSchluessel,
  entwurfWeichtAb,
  formatUhrzeit,
  geaenderteFelder,
  ladeEntwurf,
  speichereEntwurf,
  verwerfeEntwurf,
} from "@/lib/dauerauftrag-entwurf";
import type { Dauerauftrag } from "@/lib/dauerauftraege";

function fakeStore() {
  const daten = new Map<string, string>();
  return {
    daten,
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => void daten.set(k, v),
    removeItem: (k: string) => void daten.delete(k),
  };
}

const basis = { id: "r1", patient: "A", wochentage: [1, 2] } as unknown as Dauerauftrag;

describe("Dauerauftrag-Entwürfe (Auto-Save)", () => {
  it("bildet stabile Schlüssel für Neuanlage und Bearbeitung", () => {
    expect(entwurfSchluessel(null)).toBe("ghasi:dauerauftrag-entwurf:neu");
    expect(entwurfSchluessel("r1")).toBe("ghasi:dauerauftrag-entwurf:r1");
  });

  it("speichert und lädt einen Entwurf zurück", () => {
    const store = fakeStore();
    const jetzt = new Date("2026-09-10T12:00:00.000Z");
    speichereEntwurf("k", basis, jetzt, store);
    const geladen = ladeEntwurf("k", jetzt, store);
    expect(geladen?.werte.patient).toBe("A");
    expect(geladen?.gespeichertAm).toBe(jetzt.toISOString());
  });

  it("verwirft abgelaufene Entwürfe", () => {
    const store = fakeStore();
    const jetzt = new Date("2026-09-10T12:00:00.000Z");
    speichereEntwurf("k", basis, jetzt, store);
    const spaeter = new Date(jetzt.getTime() + ENTWURF_MAX_ALTER_MS + 1000);
    expect(ladeEntwurf("k", spaeter, store)).toBeNull();
    expect(store.getItem("k")).toBeNull();
  });

  it("verwirft kaputtes JSON und unvollständige Einträge", () => {
    const store = fakeStore();
    store.setItem("k", "{kaputt");
    expect(ladeEntwurf("k", new Date(), store)).toBeNull();
    store.setItem("k2", JSON.stringify({ werte: basis }));
    expect(ladeEntwurf("k2", new Date(), store)).toBeNull();
  });

  it("löscht Entwürfe auf Wunsch", () => {
    const store = fakeStore();
    speichereEntwurf("k", basis, new Date(), store);
    verwerfeEntwurf("k", store);
    expect(ladeEntwurf("k", new Date(), store)).toBeNull();
  });

  it("erkennt Abweichungen und geänderte Felder", () => {
    const entwurf = { ...basis, patient: "B", wochentage: [1, 2] } as Dauerauftrag;
    expect(entwurfWeichtAb(entwurf, basis)).toBe(true);
    expect(entwurfWeichtAb({ ...basis }, basis)).toBe(false);
    expect(geaenderteFelder(entwurf, basis)).toEqual(["patient"]);
  });

  it("formatiert den Speicherzeitpunkt", () => {
    expect(formatUhrzeit("nicht-datum")).toBe("");
    expect(formatUhrzeit(new Date(2026, 8, 10, 9, 5).toISOString())).toBe("09:05");
  });
});
