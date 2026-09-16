import { describe, expect, test } from "bun:test";

import type { ParsedSheet } from "@/lib/import-parse";
import type { Rechnung } from "@/lib/finance";
import {
  bankBuchungen,
  findeMatch,
  matcheBuchungen,
  parseBetrag,
  type BankBuchung,
} from "@/lib/bank-import";

const rechnung = (patch: Partial<Rechnung> = {}): Rechnung => ({
  id: "r-47",
  nummer: "RE-2026-0047",
  typ: "rechnung",
  kunde: "Selbstzahler A. Klein",
  kundeId: "k-47",
  abrechnungsart: "Privat",
  betrag: 410,
  mwstSatz: 0,
  status: "offen",
  datum: "2026-09-01",
  faelligkeit: "2026-09-15",
  positionen: [{ beschreibung: "Fahrt", menge: 1, einzelpreis: 410 }],
  ...patch,
});
const buchung = (patch: Partial<BankBuchung> = {}): BankBuchung => ({
  datum: "2026-09-15",
  betrag: 410,
  referenz: "Zahlung RE-2026-0047 Klein",
  ...patch,
});

describe("Bank-Import — Beträge", () => {
  test("parst deutsches Kommaformat und Tausenderpunkte", () => {
    expect(parseBetrag("410,00")).toBe(410);
    expect(parseBetrag("1.234,56 EUR")).toBe(1234.56);
  });

  test("parst internationales Zahlenformat", () => {
    expect(parseBetrag("1,234.56")).toBe(1234.56);
  });
});

describe("Bank-Import — Kontoauszug", () => {
  test("liest positiven Zahlungseingang und überspringt Belastungen", () => {
    const sheet: ParsedSheet = {
      headers: ["Buchungstag", "Betrag", "Verwendungszweck"],
      rows: [
        { Buchungstag: "15.09.2026", Betrag: "410,00", Verwendungszweck: "RE-2026-0047" },
        { Buchungstag: "15.09.2026", Betrag: "-20,00", Verwendungszweck: "Gebühr" },
      ],
    };
    expect(bankBuchungen(sheet)).toEqual([
      { datum: "2026-09-15", betrag: 410, referenz: "RE-2026-0047" },
    ]);
  });

  test("blockiert positive Buchungen ohne gültiges Datum statt 'heute' zu erfinden", () => {
    const sheet: ParsedSheet = {
      headers: ["Buchungstag", "Betrag"],
      rows: [{ Buchungstag: "31.02.2026", Betrag: "410,00" }],
    };
    expect(() => bankBuchungen(sheet)).toThrow("Ungültiges oder fehlendes Buchungsdatum");
  });

  test("blockiert fehlende Pflichtspalten eindeutig", () => {
    expect(() => bankBuchungen({ headers: ["Betrag"], rows: [] })).toThrow("Datums-Spalte");
    expect(() => bankBuchungen({ headers: ["Buchungstag"], rows: [] })).toThrow("Betragsspalte");
  });
});

describe("Bank-Import — Rechnungs-Matching", () => {
  test("erkennt Rechnungsnummer plus exakten Restbetrag als perfekten Treffer", () => {
    const match = findeMatch(buchung(), [rechnung()]);
    expect(match.kandidat?.nummer).toBe("RE-2026-0047");
    expect(match.score).toBe(1);
    expect(match.grund).toContain("Rechnungsnr.");
    expect(match.grund).toContain("Betrag stimmt exakt");
  });
  test("bewertet Rechnungsnummer ohne passenden Betrag nur als Teiltreffer", () => {
    const match = findeMatch(buchung({ betrag: 399 }), [rechnung()]);
    expect(match.kandidat?.nummer).toBe("RE-2026-0047");
    expect(match.score).toBe(0.6);
  });

  test("bewertet exakten Betrag ohne Rechnungsnummer nur als Teiltreffer", () => {
    const match = findeMatch(buchung({ referenz: "Überweisung Klein" }), [rechnung()]);
    expect(match.kandidat?.nummer).toBe("RE-2026-0047");
    expect(match.score).toBe(0.4);
  });

  test("ignoriert vollständig bezahlte Rechnungen", () => {
    const match = findeMatch(buchung(), [rechnung({ status: "bezahlt", bezahlterBetrag: 410 })]);
    expect(match.kandidat).toBeNull();
    expect(match.score).toBe(0);
  });

  test("matched mehrere Buchungen unabhängig", () => {
    const matches = matcheBuchungen(
      [buchung(), buchung({ betrag: 50, referenz: "ohne Bezug" })],
      [rechnung()],
    );
    expect(matches).toHaveLength(2);
    expect(matches[0].score).toBe(1);
    expect(matches[1].score).toBe(0);
  });
});
