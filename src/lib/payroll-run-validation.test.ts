// Tests für den Berechnungskern der Lohnläufe.
// Schwerpunkt: es wird NIE geschätzt, nie auf 0 gesetzt, fehlende Grundlagen
// führen immer zu "unvollstaendig" mit klarer Begründung.
import { describe, expect, it } from "bun:test";

import type { Beschaeftigungsverhaeltnis } from "@/lib/employment-shared";
import type { LohnFakt, LohnRegel } from "@/lib/payroll-shared";
import {
  arbeitsstundenSchluessel,
  berechneLohnlauf,
  createLohnlaufSchema,
  GRUND_FEHLENDE_ARBEITSZEIT,
  mapLohnlaufDbError,
  monatsZeitraum,
} from "@/lib/payroll-run-shared";

const FAHRER = "11111111-1111-4111-8111-111111111111";

function emp(p: Partial<Beschaeftigungsverhaeltnis> = {}): Beschaeftigungsverhaeltnis {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    fahrerId: FAHRER,
    verguetungsart: "monatsbrutto",
    stundenlohn: null,
    monatsbrutto: 3000,
    gueltigAb: "2026-01-01",
    gueltigBis: null,
    status: "verifiziert",
    version: 2,
    notiz: "",
    erstelltVon: null,
    verifiziertVon: null,
    verifiziertAm: null,
    createdAt: "",
    updatedAt: "",
    ...p,
  };
}

function regel(p: Partial<LohnRegel> = {}): LohnRegel {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    kennung: "kv_an",
    bezeichnung: "Krankenversicherung Arbeitnehmer",
    kategorie: "arbeitnehmerabzug",
    berechnungsart: "prozent",
    prozentsatz: 10,
    festbetrag: null,
    benoetigterFakt: null,
    gueltigAb: "2026-01-01",
    gueltigBis: null,
    quelle: "§ 241 SGB V",
    quelleVersion: "2026",
    status: "verifiziert",
    version: 2,
    notiz: "",
    erstelltVon: null,
    verifiziertVon: null,
    verifiziertAm: null,
    createdAt: "",
    updatedAt: "",
    ...p,
  };
}

function fakt(p: Partial<LohnFakt> = {}): LohnFakt {
  return {
    id: "44444444-4444-4444-4444-444444444444",
    fahrerId: FAHRER,
    faktSchluessel: "steuerklasse",
    wert: "1",
    gueltigAb: "2026-01-01",
    gueltigBis: null,
    status: "verifiziert",
    version: 2,
    notiz: "",
    erstelltVon: null,
    verifiziertVon: null,
    verifiziertAm: null,
    createdAt: "",
    updatedAt: "",
    ...p,
  };
}

describe("Zeitraum-Helfer", () => {
  it("bildet vollen Kalendermonat", () => {
    expect(monatsZeitraum("2026-08")).toEqual({ ab: "2026-08-01", bis: "2026-08-31" });
    expect(monatsZeitraum("2026-02")).toEqual({ ab: "2026-02-01", bis: "2026-02-28" });
    expect(monatsZeitraum("2028-02").bis).toBe("2028-02-29");
  });

  it("bildet den Stunden-Faktschlüssel", () => {
    expect(arbeitsstundenSchluessel("2026-08")).toBe("arbeitsstunden_2026_08");
  });
});

describe("Validierung", () => {
  it("akzeptiert nur YYYY-MM", () => {
    expect(createLohnlaufSchema.safeParse({ fahrerId: FAHRER, monat: "2026-08" }).success).toBe(
      true,
    );
    expect(createLohnlaufSchema.safeParse({ fahrerId: FAHRER, monat: "2026-8" }).success).toBe(
      false,
    );
    expect(createLohnlaufSchema.safeParse({ fahrerId: FAHRER, monat: "2026-13" }).success).toBe(
      false,
    );
  });

  it("lehnt unbekannte Felder ab (strict)", () => {
    expect(
      createLohnlaufSchema.safeParse({ fahrerId: FAHRER, monat: "2026-08", brutto: 5000 }).success,
    ).toBe(false);
  });
});

describe("Festgehalt", () => {
  it("nimmt den hinterlegten Monatsbetrag und bildet Posten je Regel", () => {
    const r = berechneLohnlauf({
      monat: "2026-08",
      fahrerId: FAHRER,
      beschaeftigungen: [emp()],
      regeln: [
        regel(),
        regel({
          id: "55555555-5555-5555-5555-555555555555",
          kennung: "ag_kv",
          kategorie: "arbeitgeberkosten",
          berechnungsart: "festbetrag",
          prozentsatz: null,
          festbetrag: 50,
        }),
      ],
      fakten: [],
    });
    expect(r.status).toBe("berechnet");
    expect(r.brutto).toBe(3000);
    expect(r.posten).toHaveLength(2);
    expect(r.summeAbzuege).toBe(300);
    expect(r.netto).toBe(2700);
    expect(r.summeArbeitgeberkosten).toBe(50);
    expect(r.posten[0]?.regelKennung).toBe("kv_an");
    expect(r.posten[0]?.basisbetrag).toBe(3000);
  });
});

describe("Stundenlohn", () => {
  const stundenEmp = emp({ verguetungsart: "stundenlohn", stundenlohn: 20, monatsbrutto: null });

  it("markiert ohne geprüfte Arbeitszeiterfassung als unvollständig (nicht 0)", () => {
    const r = berechneLohnlauf({
      monat: "2026-08",
      fahrerId: FAHRER,
      beschaeftigungen: [stundenEmp],
      regeln: [regel()],
      fakten: [],
    });
    expect(r.status).toBe("unvollstaendig");
    expect(r.brutto).toBeNull();
    expect(r.posten).toHaveLength(0);
    expect(r.fehlendePunkte.join(" ")).toContain(GRUND_FEHLENDE_ARBEITSZEIT);
  });

  it("ignoriert einen NICHT verifizierten Stunden-Fakt", () => {
    const r = berechneLohnlauf({
      monat: "2026-08",
      fahrerId: FAHRER,
      beschaeftigungen: [stundenEmp],
      regeln: [],
      fakten: [
        fakt({
          faktSchluessel: "arbeitsstunden_2026_08",
          wert: "160",
          status: "pruefung_erforderlich",
        }),
      ],
    });
    expect(r.status).toBe("unvollstaendig");
  });

  it("berechnet mit verifizierter Stundenquelle", () => {
    const r = berechneLohnlauf({
      monat: "2026-08",
      fahrerId: FAHRER,
      beschaeftigungen: [stundenEmp],
      regeln: [regel()],
      fakten: [fakt({ faktSchluessel: "arbeitsstunden_2026_08", wert: "160,5" })],
    });
    expect(r.status).toBe("berechnet");
    expect(r.stunden).toBe(160.5);
    expect(r.brutto).toBe(3210);
    expect(r.netto).toBe(2889);
  });
});

describe("Vollständigkeitsregeln", () => {
  it("meldet fehlendes verifiziertes Beschäftigungsverhältnis", () => {
    const r = berechneLohnlauf({
      monat: "2026-08",
      fahrerId: FAHRER,
      beschaeftigungen: [emp({ status: "pruefung_erforderlich" })],
      regeln: [regel()],
      fakten: [],
    });
    expect(r.status).toBe("unvollstaendig");
    expect(r.fehlendePunkte[0]).toContain("Beschäftigungsverhältnis");
  });

  it("verlangt Abdeckung des GESAMTEN Monats", () => {
    const r = berechneLohnlauf({
      monat: "2026-08",
      fahrerId: FAHRER,
      beschaeftigungen: [emp({ gueltigBis: "2026-08-15" })],
      regeln: [],
      fakten: [],
    });
    expect(r.status).toBe("unvollstaendig");
  });

  it("meldet fehlenden benötigten Fakt einer Regel", () => {
    const r = berechneLohnlauf({
      monat: "2026-08",
      fahrerId: FAHRER,
      beschaeftigungen: [emp()],
      regeln: [regel({ benoetigterFakt: "kv_status" })],
      fakten: [],
    });
    expect(r.status).toBe("unvollstaendig");
    expect(r.fehlendePunkte[0]).toContain("kv_status");
    expect(r.posten).toHaveLength(0);
  });

  it("rechnet mit vorhandenem benötigtem Fakt", () => {
    const r = berechneLohnlauf({
      monat: "2026-08",
      fahrerId: FAHRER,
      beschaeftigungen: [emp()],
      regeln: [regel({ benoetigterFakt: "kv_status" })],
      fakten: [fakt({ faktSchluessel: "kv_status", wert: "pflichtversichert" })],
    });
    expect(r.status).toBe("berechnet");
    expect(r.posten).toHaveLength(1);
  });

  it("ignoriert Regeln außerhalb des Zeitraums und nicht verifizierte Regeln", () => {
    const r = berechneLohnlauf({
      monat: "2026-08",
      fahrerId: FAHRER,
      beschaeftigungen: [emp()],
      regeln: [
        regel({ gueltigBis: "2026-07-31" }),
        regel({ id: "66666666-6666-6666-6666-666666666666", status: "entwurf" }),
      ],
      fakten: [],
    });
    expect(r.status).toBe("berechnet");
    expect(r.posten).toHaveLength(0);
    expect(r.summeAbzuege).toBe(0);
    expect(r.netto).toBe(3000);
  });

  it("nimmt keine Daten eines anderen Fahrers", () => {
    const r = berechneLohnlauf({
      monat: "2026-08",
      fahrerId: FAHRER,
      beschaeftigungen: [emp({ fahrerId: "99999999-9999-4999-8999-999999999999" })],
      regeln: [],
      fakten: [],
    });
    expect(r.status).toBe("unvollstaendig");
  });
});

describe("Fehler-Mapping", () => {
  it("übersetzt Doppelanlage und Zugriffsfehler", () => {
    expect(
      mapLohnlaufDbError('duplicate key value violates "payroll_runs_unique_periode"'),
    ).toContain("bereits ein Lohnlauf");
    expect(mapLohnlaufDbError("new row violates row-level security policy")).toContain(
      "Kein Zugriff",
    );
  });
});
