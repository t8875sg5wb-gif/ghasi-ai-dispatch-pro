import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { INITIAL_FAHRER } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import { INITIAL_RECHNUNGEN, computeFinanzKpis, computeKostenaufstellung } from "@/lib/finance";
import { computeCashflowForecast } from "@/lib/ceo-intelligence";
import type { BrainKpis } from "@/lib/ai-brain";

const fahrerBackup = [...INITIAL_FAHRER];
const fahrzeugeBackup = [...INITIAL_FAHRZEUGE];
const rechnungenBackup = [...INITIAL_RECHNUNGEN];

function replace<T>(target: T[], values: T[]) {
  target.splice(0, target.length, ...values);
}

beforeEach(() => {
  replace(INITIAL_FAHRER, []);
  replace(INITIAL_FAHRZEUGE, []);
  replace(INITIAL_RECHNUNGEN, []);
});

afterEach(() => {
  replace(INITIAL_FAHRER, fahrerBackup);
  replace(INITIAL_FAHRZEUGE, fahrzeugeBackup);
  replace(INITIAL_RECHNUNGEN, rechnungenBackup);
});
describe("numerische Sicherheit bei leeren Live-Daten", () => {
  test("Finanzkosten bleiben endlich und werden bei leerer Flotte zu 0", () => {
    const kosten = computeKostenaufstellung();
    expect(kosten.fahrzeugkosten).toBe(0);
    expect(kosten.kraftstoffkosten).toBe(0);
    expect(kosten.wartungskosten).toBe(0);
    expect(kosten.fahrerkosten).toBe(0);
    expect(kosten.leasingkosten).toBe(0);
    for (const value of Object.values(kosten).filter((v): v is number => typeof v === "number")) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  test("explizite Live-Flotte ist unabhaengig vom Legacy-Mirror", () => {
    const basis = fahrzeugeBackup[0]!;
    const live = {
      ...basis,
      id: "live-finance-1",
      kennzeichen: "MI-LIVE 1",
      reparaturen: [{ datum: "2026-09-01", beschreibung: "synthetisch", kosten: 123 }],
      leasingrate: 456,
    };
    const phantom = {
      ...basis,
      id: "phantom-finance-1",
      kennzeichen: "PHANTOM",
      reparaturen: [{ datum: "2026-09-01", beschreibung: "phantom", kosten: 9999 }],
      leasingrate: 9999,
    };
    replace(INITIAL_FAHRZEUGE, [phantom]);

    const kosten = computeKostenaufstellung({
      fahrer: [],
      fahrzeuge: [live],
      auftraege: [],
      jetzt: new Date("2026-09-16T12:00:00+02:00"),
    });
    expect(kosten.datenbasisVorhanden).toBe(true);
    expect(kosten.wartungskosten).toBe(123);
    expect(kosten.leasingkosten).toBe(456);
    expect(kosten.wartungskosten).not.toBe(9999);
  });

  test("Legacy-Fahrerumsatz erzeugt ohne Auftraege keine Fahrer- oder Fahrzeugkosten", () => {
    const basisFahrer = fahrerBackup[0]!;
    const basisFahrzeug = fahrzeugeBackup[0]!;
    const kosten = computeKostenaufstellung({
      fahrer: [{ ...basisFahrer, kmHeute: 9999, umsatzHeute: 99999, gewinnHeute: -99999 }],
      fahrzeuge: [basisFahrzeug],
      auftraege: [],
      jetzt: new Date("2026-09-16T12:00:00+02:00"),
    });
    expect(kosten.fahrerkosten).toBe(0);
    expect(kosten.fahrzeugkosten).toBe(0);
  });

  test("ohne explizite Flottendaten wird die Kostenbasis als fehlend markiert", () => {
    const kosten = computeKostenaufstellung();
    expect(kosten.datenbasisVorhanden).toBe(false);
  });

  test("Finanz-KPIs enthalten bei leerem Startzustand kein NaN", () => {
    const kpis = computeFinanzKpis();
    for (const [key, value] of Object.entries(kpis)) {
      if (typeof value === "number") {
        expect(Number.isFinite(value), key).toBe(true);
      }
    }
  });
  test("CEO-Cashflow erfindet ohne Umsatz keine 8.000-Euro-Tagesbasis", () => {
    const zero: BrainKpis = {
      aktiveFahrzeuge: 0,
      freieFahrzeuge: 0,
      aktiveFahrer: 0,
      freieFahrer: 0,
      laufendeTransporte: 0,
      offeneTransporte: 0,
      patientenUnterwegs: 0,
      umsatzHeute: 0,
      umsatzMonat: 0,
      gewinnHeute: 0,
      gewinnMonat: 0,
      margeProzent: 0,
      offeneRechnungen: 0,
      flottenauslastung: 0,
      fahrerauslastung: 0,
      wartungOffen: 0,
      kritischeAlarme: 0,
      aiEffizienz: 0,
      durchschnittPuenktlichkeit: 0,
      durchschnittBewertung: 0,
    };
    const forecast = computeCashflowForecast(zero);
    expect(forecast.every((f) => f.umsatz === 0)).toBe(true);
    expect(forecast.every((f) => f.ausgaben === 0)).toBe(true);
    expect(forecast.every((f) => Number.isFinite(f.cashflow))).toBe(true);
  });
});
