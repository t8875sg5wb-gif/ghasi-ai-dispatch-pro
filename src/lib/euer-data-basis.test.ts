import { describe, expect, it } from "bun:test";

import { euerDatenbasis } from "@/lib/euer";
import type { Ausgabe } from "@/lib/expenses-shared";
import type { Rechnung } from "@/lib/finance";

function rechnung(p: Partial<Rechnung> = {}): Rechnung {
  return {
    id: "r1",
    nummer: "RE-1",
    typ: "rechnung",
    kunde: "Testkunde",
    kundeId: "k1",
    abrechnungsart: "Kunde",
    betrag: 100,
    mwstSatz: 0,
    status: "offen",
    datum: "2026-01-10",
    faelligkeit: "2026-01-24",
    positionen: [],
    ...p,
  };
}

const ausgabe: Ausgabe = {
  id: "a1",
  datum: "2026-02-01",
  kategorie: "Kraftstoff",
  lieferant: "Test",
  betragBrutto: 0,
  ustSatz: 0,
};

describe("EÜR-Datenbasis", () => {
  it("meldet leere Quellen ausdrücklich als fehlend", () => {
    const r = euerDatenbasis(2026, [], []);
    expect(r.vorhanden).toBe(false);
    expect(r.hinweis).toContain("kein bestätigter Jahreswert");
  });

  it("wertet eine offene Rechnung ohne Zahlung nicht als EÜR-Grundlage", () => {
    expect(euerDatenbasis(2026, [rechnung()], []).vorhanden).toBe(false);
  });

  it("wertet einen echten Zahlungseingang als Grundlage, auch wenn der Betrag 0 wäre", () => {
    const r = euerDatenbasis(
      2026,
      [rechnung({ status: "bezahlt", zahlungen: [{ datum: "2026-03-01", betrag: 0 }] })],
      [],
    );
    expect(r.vorhanden).toBe(true);
    expect(r.zahlungseingaenge).toBe(1);
  });

  it("wertet einen Ausgabenbeleg als Grundlage, auch wenn der Betrag 0 ist", () => {
    const r = euerDatenbasis(2026, [], [ausgabe]);
    expect(r.vorhanden).toBe(true);
    expect(r.ausgabenbelege).toBe(1);
  });

  it("ignoriert Belege außerhalb des gewählten Jahres", () => {
    const r = euerDatenbasis(2025, [], [ausgabe]);
    expect(r.vorhanden).toBe(false);
  });
});
