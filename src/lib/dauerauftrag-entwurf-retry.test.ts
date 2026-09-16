// Tests für Fehlermeldung und Retry-Logik des Auto-Save von Dauerauftragsentwürfen.
import { describe, expect, it } from "bun:test";

import {
  ENTWURF_RETRY_MS,
  RETRY_BESTAETIGUNG_MS,
  formatZeitmarke,
  retryBestaetigungSichtbar,
  retryBestaetigungText,
  retryVerzoegerung,
  versucheEntwurfZuSpeichern,
  entwurfFehlerBericht,
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

describe("entwurfFehlerBericht", () => {
  it("enthält Zeitpunkt, Ursache, Kontext und Aufrufkette", () => {
    const bericht = entwurfFehlerBericht({
      zeitpunkt: "2026-09-14T10:00:00.000Z",
      grund: "voll",
      meldung: "Der Zwischenspeicher des Browsers ist voll.",
      versuche: 2,
      wiederholt: true,
      technik: {
        name: "QuotaExceededError",
        message: "quota exceeded",
        stack: "at setItem (storage)",
        nutzlastBytes: 4242,
        schluessel: "ghasi:dauerauftrag-entwurf:neu",
      },
      datensatz: "Neuanlage",
      umgebung: { userAgent: "TestAgent", url: "https://example.test/dauerauftraege" },
    });
    expect(bericht).toContain("2026-09-14T10:00:00.000Z");
    expect(bericht).toContain("Zwischenspeicher voll (Quota)");
    expect(bericht).toContain("QuotaExceededError");
    expect(bericht).toContain("4242 Zeichen");
    expect(bericht).toContain("ghasi:dauerauftrag-entwurf:neu");
    expect(bericht).toContain("TestAgent");
    expect(bericht).toContain("at setItem (storage)");
  });

  it("meldet fehlende Aufrufkette verständlich", () => {
    const bericht = entwurfFehlerBericht({
      zeitpunkt: "2026-09-14T10:00:00.000Z",
      grund: "kein_speicher",
      meldung: "kein Speicher",
      versuche: 1,
      wiederholt: false,
      technik: { name: "SpeicherNichtVerfuegbar", message: "blockiert", schluessel: "k" },
      datensatz: "Neuanlage",
    });
    expect(bericht).toContain("(keine Aufrufkette verfügbar)");
    expect(bericht).toContain("kein automatischer Neuversuch mehr");
  });
});

describe("Footer-Bestätigung nach erfolgreichem Retry", () => {
  const erfolgIso = new Date(2026, 8, 16, 14, 5, 0).toISOString();
  const jetzt = new Date(2026, 8, 16, 14, 6, 0);

  it("zeigt die Bestätigung mit dem aktualisierten Speicherzeitpunkt", () => {
    const text = retryBestaetigungText(erfolgIso, jetzt);
    expect(text).toContain("Neuversuch erfolgreich");
    // Der neue Speicherzeitpunkt erscheint sofort im Text.
    expect(text).toContain(formatZeitmarke(erfolgIso, jetzt));
    expect(text).toContain("heute 14:05 Uhr");
  });

  it("ist direkt nach dem erfolgreichen Retry sichtbar", () => {
    expect(retryBestaetigungSichtbar(erfolgIso, new Date(erfolgIso))).toBe(true);
    // Auch kurz vor Ablauf der Anzeigedauer noch sichtbar.
    const knappVorEnde = new Date(Date.parse(erfolgIso) + RETRY_BESTAETIGUNG_MS - 1);
    expect(retryBestaetigungSichtbar(erfolgIso, knappVorEnde)).toBe(true);
  });

  it("verschwindet nach 5 Sekunden wieder", () => {
    expect(RETRY_BESTAETIGUNG_MS).toBe(5000);
    const nachAblauf = new Date(Date.parse(erfolgIso) + RETRY_BESTAETIGUNG_MS);
    expect(retryBestaetigungSichtbar(erfolgIso, nachAblauf)).toBe(false);
    const spaeter = new Date(Date.parse(erfolgIso) + 60_000);
    expect(retryBestaetigungSichtbar(erfolgIso, spaeter)).toBe(false);
  });

  it("zeigt nichts ohne Speicherzeitpunkt oder bei ungültiger Zeitangabe", () => {
    expect(retryBestaetigungSichtbar(null, jetzt)).toBe(false);
    expect(retryBestaetigungSichtbar("keine-zeit", jetzt)).toBe(false);
    // Zeitpunkt in der Zukunft (Uhrenfehler) gilt nicht als sichtbar.
    const vorher = new Date(Date.parse(erfolgIso) - 1000);
    expect(retryBestaetigungSichtbar(erfolgIso, vorher)).toBe(false);
  });
});

describe("Reihenfolge bei schnellen Neuversuchen", () => {
  it("erkennt nur den jüngsten Versuch als maßgeblich", () => {
    expect(istAktuellerVersuch(3, 3)).toBe(true);
    expect(istAktuellerVersuch(2, 3)).toBe(false);
  });

  it("nimmt bei mehreren Ergebnissen den Zeitpunkt des letzten Versuchs", () => {
    expect(
      letzterSpeicherzeitpunkt([
        { versuchId: 1, gespeichertAm: "2026-09-16T12:00:00.000Z" },
        { versuchId: 3, gespeichertAm: "2026-09-16T12:00:02.000Z" },
        { versuchId: 2, gespeichertAm: "2026-09-16T12:00:05.000Z" },
      ]),
    ).toBe("2026-09-16T12:00:02.000Z");
  });

  it("gibt ohne Ergebnisse null zurück", () => {
    expect(letzterSpeicherzeitpunkt([])).toBeNull();
  });
});
