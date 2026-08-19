import { describe, expect, it } from "bun:test";

import {
  buildDatevLohnexport,
  DATEV_LOHN_WARNUNG,
  LOHNART_PLATZHALTER,
} from "@/lib/datev-lohn-export";
import type { Lohnlauf, LohnlaufPosten, LohnlaufStatus } from "@/lib/payroll-run-shared";

function posten(over: Partial<LohnlaufPosten> = {}): LohnlaufPosten {
  return {
    id: "p1",
    lohnlaufId: "l1",
    regelId: "r1",
    regelKennung: "kv_an",
    regelBezeichnung: "Krankenversicherung Arbeitnehmer",
    kategorie: "abzug_arbeitnehmer",
    berechnungsart: "prozent_vom_brutto",
    prozentsatz: 8.55,
    festbetrag: null,
    basisbetrag: 2500,
    betrag: -213.75,
    quelle: "GKV 2026",
    quelleVersion: "2026-01",
    ...over,
  };
}

function lauf(status: LohnlaufStatus = "freigegeben"): Lohnlauf {
  return {
    id: "l1",
    fahrerId: "11111111-1111-1111-1111-111111111111",
    periodeMonat: "2026-07-01",
    status,
    beschaeftigungId: "b1",
    verguetungsart: "monatsbrutto",
    stunden: null,
    stundenlohn: null,
    brutto: 2500,
    summeAbzuege: 213.75,
    netto: 2286.25,
    summeArbeitgeberkosten: 500,
    fehlendePunkte: [],
    berechnetAm: "2026-08-01T10:00:00Z",
    berechnetVon: "u1",
    vorgelegtVon: "u1",
    vorgelegtAm: "2026-08-01T11:00:00Z",
    vorgelegtVersion: 3,
    freigegebenVon: "u2",
    freigegebenAm: "2026-08-02T09:00:00Z",
    entschiedenVon: "u2",
    entschiedenAm: "2026-08-02T09:00:00Z",
    ablehnungGrund: null,
    version: 3,
    notiz: "",
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt: "2026-08-02T09:00:00Z",
    posten: [posten()],
  };
}

const opts = { beraterNr: "12345", mandantNr: "67890", fahrerName: "Max Mustermann" };

describe("buildDatevLohnexport", () => {
  it("exportiert nur freigegebene Lohnläufe", () => {
    for (const s of ["offen", "berechnet", "unvollstaendig", "zur_freigabe"] as LohnlaufStatus[]) {
      expect(() => buildDatevLohnexport(lauf(s), opts)).toThrow(/freigegebene/);
    }
    expect(() => buildDatevLohnexport(lauf(), opts)).not.toThrow();
  });

  it("nutzt einen auffälligen Lohnart-Platzhalter statt eines Zahlencodes", () => {
    const { csv } = buildDatevLohnexport(lauf(), opts);
    expect(LOHNART_PLATZHALTER).toBe("LOHNART_PRUEFEN");
    expect(csv).toContain(LOHNART_PLATZHALTER);
    // Keine Zeile darf eine reine Zahl als Lohnart führen.
    const zeilen = csv.split("\r\n").filter((z) => !z.startsWith("#") && z.includes(";"));
    for (const z of zeilen.slice(1)) {
      expect(z.split(";")[6]).toBe(LOHNART_PLATZHALTER);
    }
  });

  it("enthält den Warnhinweis, Fahrer-Referenz, Zeitraum und Summenzeilen", () => {
    const { csv, anzahl, dateiname } = buildDatevLohnexport(lauf(), opts);
    expect(csv).toContain(DATEV_LOHN_WARNUNG);
    expect(csv).toContain("Max Mustermann");
    expect(csv).toContain("07/2026");
    expect(csv).toContain("Bruttolohn");
    expect(csv).toContain("Summe Arbeitgeberkosten");
    expect(anzahl).toBe(1);
    expect(dateiname).toBe("DATEV-Lohn-ENTWURF-2026-07-Max_Mustermann.csv");
  });

  it("nutzt deutsches Zahlenformat ohne Tausenderpunkte", () => {
    const { csv } = buildDatevLohnexport(lauf(), opts);
    expect(csv).toContain("2500,00");
    expect(csv).toContain("-213,75");
    expect(csv).not.toContain("2.500");
  });
});
