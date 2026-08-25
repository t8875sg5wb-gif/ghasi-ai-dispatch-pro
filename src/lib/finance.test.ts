import { describe, expect, it } from "bun:test";

import type { Rechnung } from "@/lib/finance";
import { computeFinanzKpis, offenePostenJeKunde, offenerBetrag, brutto } from "@/lib/finance";

const rechnung = (patch: Partial<Rechnung> = {}): Rechnung => ({
  id: "r-test",
  nummer: "RE-2026-TEST",
  typ: "rechnung",
  kunde: "Musterkasse",
  kundeId: "k-test",
  abrechnungsart: "Krankenkasse",
  betrag: 100,
  mwstSatz: 19,
  status: "offen",
  datum: "2026-06-01",
  faelligkeit: "2026-06-15",
  positionen: [{ beschreibung: "Fahrt", menge: 1, einzelpreis: 100 }],
  ...patch,
});

describe("computeFinanzKpis", () => {
  it("rechnet Offene Posten brutto (inkl. MwSt.)", () => {
    const r = rechnung();
    expect(offenerBetrag(r)).toBe(119);
    expect(brutto(r)).toBe(119);

    const kpis = computeFinanzKpis([r]);
    expect(kpis.offenePosten).toBe(119);
  });

  it("rechnet teilbezahlte Rechnungen mit MwSt. als Restbetrag", () => {
    const r = rechnung({
      status: "teilbezahlt",
      bezahlterBetrag: undefined,
      zahlungen: [{ datum: "2026-06-10", betrag: 50 }],
    });
    expect(offenerBetrag(r)).toBe(69); // 119 brutto − 50 Zahlung

    const kpis = computeFinanzKpis([r]);
    expect(kpis.offenePosten).toBe(69);
  });

  it("rechnet Überfällig brutto (inkl. MwSt.)", () => {
    const r = rechnung({
      status: "ueberfaellig",
      faelligkeit: "2026-01-01",
    });

    const kpis = computeFinanzKpis([r]);
    expect(kpis.ueberfaelligeSumme).toBe(119);
  });

  it("rechnet Bezahlt brutto anhand der Zahlungssumme", () => {
    const r = rechnung({
      status: "bezahlt",
      bezahlterBetrag: undefined,
      zahlungen: [{ datum: "2026-06-10", betrag: 119 }],
    });

    const kpis = computeFinanzKpis([r]);
    expect(kpis.bezahltSumme).toBe(119);
  });
});

describe("offenePostenJeKunde", () => {
  it("rechnet Kundenposten brutto (inkl. MwSt.)", () => {
    const r = rechnung();
    const posten = offenePostenJeKunde([r]);
    expect(posten).toHaveLength(1);
    expect(posten[0].betrag).toBe(119);
  });
});
