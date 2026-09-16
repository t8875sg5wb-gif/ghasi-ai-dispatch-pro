import { describe, expect, it } from "bun:test";

import { buildBericht, bewerteBerichtGrundlage, type BerichtDatenzaehler } from "@/lib/reporting";

const basis: BerichtDatenzaehler = {
  rechnungen: 1,
  fahrzeuge: 1,
  fahrer: 1,
  kunden: 1,
  patienten: 1,
  auftraege: 1,
};

describe("Bericht-Datenbasis", () => {
  it("unterscheidet fehlende Rechnungsdaten von echtem Nullumsatz", () => {
    expect(bewerteBerichtGrundlage("umsatz", { ...basis, rechnungen: 0 })).toMatchObject({
      vorhanden: false,
    });
    expect(bewerteBerichtGrundlage("umsatz", basis)).toMatchObject({
      vorhanden: true,
    });
  });

  it("blockiert Gewinnbericht bei unvollständiger Grundlage", () => {
    const r = bewerteBerichtGrundlage("gewinn", {
      ...basis,
      fahrzeuge: 0,
      fahrer: 0,
    });
    expect(r.vorhanden).toBe(false);
    expect(r.hinweis).toContain("Fahrzeuge");
    expect(r.hinweis).toContain("Fahrer");
  });

  it("verlangt für Kundenumsatz Kunden und Rechnungen", () => {
    expect(
      bewerteBerichtGrundlage("kunden", { ...basis, kunden: 1, rechnungen: 0 }).vorhanden,
    ).toBe(false);
    expect(
      bewerteBerichtGrundlage("kunden", { ...basis, kunden: 1, rechnungen: 1 }).vorhanden,
    ).toBe(true);
  });

  it("behandelt vorhandene Quelle unabhängig vom später berechneten Wert als belastbar", () => {
    for (const typ of [
      "fahrerleistung",
      "fahrzeugauslastung",
      "patienten",
      "transporte",
      "kraftstoff",
      "wartung",
    ] as const) {
      expect(bewerteBerichtGrundlage(typ, basis).vorhanden).toBe(true);
    }
  });
  it("Wartungsbericht verwendet nur explizit uebergebene Fahrzeuge", () => {
    const bericht = buildBericht("wartung", {
      rechnungen: [],
      fahrer: [],
      kunden: [],
      patienten: [],
      auftraege: [],
      fahrzeuge: [
        {
          id: "synthetic-vehicle",
          nummer: "KFZ-SYN",
          kennzeichen: "MI-SYN 1",
          marke: "Test",
          modell: "Live",
          baujahr: 2024,
          typ: "PKW",
          rollstuhlGeeignet: false,
          liegendGeeignet: false,
          sitzplaetze: 4,
          status: "frei",
          fahrer: null,
          standort: "Minden",
          gps: { lat: 52.29, lng: 8.92 },
          kilometerstand: 1000,
          tankstand: 50,
          kraftstoff: "Diesel",
          verbrauch: 6,
          reichweite: 500,
          kostenProKm: 0.4,
          tagesumsatz: 0,
          tagesgewinn: 0,
          monatsumsatz: 0,
          monatsgewinn: 0,
          tuevBis: "2027-01-01",
          oelwechselBei: 2000,
          naechsteWartung: "2027-01-01",
          reifenstatus: "gut",
          reparaturen: [{ datum: "2026-09-01", beschreibung: "synthetisch", kosten: 77 }],
          versicherung: "Test",
          versicherungBis: "2027-01-01",
          leasingrate: 0,
          leasingEnde: "",
          dokumente: [],
          fotos: [],
          notizen: "",
        },
      ],
    });
    expect(bericht.zeilen).toHaveLength(1);
    expect(bericht.zeilen[0]?.[0]).toBe("MI-SYN 1");
    expect(bericht.zeilen[0]?.[4]).toBe(77);
  });
});
