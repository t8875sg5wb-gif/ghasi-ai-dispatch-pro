// Tests für Fehlermeldung und Retry-Logik des Auto-Save von Dauerauftragsentwürfen.
import { describe, expect, it } from "bun:test";

import {
  ENTWURF_RETRY_MS,
  formatZeitmarke,
  retryVerzoegerung,
  versucheEntwurfZuSpeichern,
} from "@/lib/dauerauftrag-entwurf";
import type { Dauerauftrag } from "@/lib/dauerauftraege";

const WERTE = { id: "d-1", patient: "Testpatient" } as unknown as Dauerauftrag;

function speicher(verhalten: "ok" | "voll" | "fehler") {
  const daten = new Map<string, string>();
  return {
    daten,
    getItem: (k: string) => daten.get(k) ?? null,
    removeItem: (k: string) => void daten.delete(k),
    setItem: (k: string, v: string) => {
      if (verhalten === "voll") {
        const e = new Error("quota") as Error & { name: string };
        e.name = "QuotaExceededError";
        throw e;
      }
      if (verhalten === "fehler") throw new Error("kaputt");
      daten.set(k, v);
    },
  };
}

describe("Auto-Save: Fehler und Wiederholung", () => {
  it("speichert erfolgreich und meldet den Zeitpunkt", () => {
    const store = speicher("ok");
    const r = versucheEntwurfZuSpeichern("k", WERTE, new Date("2026-09-10T10:00:00Z"), store);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unerwartet");
    expect(r.eintrag.gespeichertAm).toBe("2026-09-10T10:00:00.000Z");
    expect(store.daten.has("k")).toBe(true);
  });

  it("meldet einen vollen Zwischenspeicher mit Grund 'voll'", () => {
    const r = versucheEntwurfZuSpeichern("k", WERTE, new Date(), speicher("voll"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unerwartet");
    expect(r.grund).toBe("voll");
    expect(r.meldung.length).toBeGreaterThan(10);
  });

  it("meldet sonstige Fehler mit Grund 'fehler'", () => {
    const r = versucheEntwurfZuSpeichern("k", WERTE, new Date(), speicher("fehler"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unerwartet");
    expect(r.grund).toBe("fehler");
  });

  it("meldet fehlenden Speicher und wiederholt dann nicht", () => {
    const r = versucheEntwurfZuSpeichern("k", WERTE, new Date(), null);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unerwartet");
    expect(r.grund).toBe("kein_speicher");
    expect(retryVerzoegerung(0, "kein_speicher")).toBeNull();
  });

  it("wiederholt mit steigender Wartezeit und endet danach", () => {
    expect(retryVerzoegerung(0, "voll")).toBe(ENTWURF_RETRY_MS[0]);
    expect(retryVerzoegerung(1, "fehler")).toBe(ENTWURF_RETRY_MS[1]);
    expect(retryVerzoegerung(2, "fehler")).toBe(ENTWURF_RETRY_MS[2]);
    expect(retryVerzoegerung(ENTWURF_RETRY_MS.length, "fehler")).toBeNull();
    for (let i = 1; i < ENTWURF_RETRY_MS.length; i++) {
      expect(ENTWURF_RETRY_MS[i]!).toBeGreaterThan(ENTWURF_RETRY_MS[i - 1]!);
    }
  });
});

describe("Zeitmarke für die Fußzeile", () => {
  it("zeigt Uhrzeit mit 'heute' für den aktuellen Tag", () => {
    const jetzt = new Date(2026, 8, 10, 18, 0, 0);
    const iso = new Date(2026, 8, 10, 15, 27, 0).toISOString();
    expect(formatZeitmarke(iso, jetzt)).toBe("heute 15:27 Uhr");
  });

  it("zeigt das Datum, wenn der Entwurf von einem anderen Tag ist", () => {
    const jetzt = new Date(2026, 8, 10, 8, 0, 0);
    const iso = new Date(2026, 8, 9, 7, 5, 0).toISOString();
    expect(formatZeitmarke(iso, jetzt)).toBe("09.09.2026 07:05 Uhr");
  });

  it("liefert leeren Text bei ungültiger Zeitangabe", () => {
    expect(formatZeitmarke("keine-zeit")).toBe("");
  });
});
