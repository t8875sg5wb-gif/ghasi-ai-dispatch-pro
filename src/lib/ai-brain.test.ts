import { describe, expect, it } from "bun:test";

import { computeKpis } from "@/lib/ai-brain";
import { computeFinanzKpis, INITIAL_RECHNUNGEN, type Rechnung } from "@/lib/finance";

describe("computeKpis Monatszahlen", () => {
  it("nutzt dieselbe Quelle wie computeFinanzKpis (keine Divergenz)", () => {
    const k = computeKpis({
      auftraege: [],
      fahrer: [],
      fahrzeuge: [],
      rechnungen: INITIAL_RECHNUNGEN,
    });
    const fin = computeFinanzKpis(INITIAL_RECHNUNGEN, { fahrer: [], fahrzeuge: [] });
    expect(k.umsatzMonat).toBe(fin.umsatzMonat);
    expect(k.gewinnMonat).toBe(fin.gewinnMonat);
    expect(k.margeProzent).toBe(fin.margeProzent);
  });

  it("ändert sich, wenn sich echte Rechnungsdaten ändern", () => {
    const jetzt = new Date("2026-09-16T12:00:00+02:00");
    const basis = computeFinanzKpis(INITIAL_RECHNUNGEN, {
      fahrer: [],
      fahrzeuge: [],
      auftraege: [],
      rechnungen: INITIAL_RECHNUNGEN,
      jetzt,
    }).umsatzMonat;
    const extra: Rechnung = {
      id: "r-extra",
      nummer: "RE-2026-EXTRA",
      typ: "rechnung",
      kunde: "Testkasse",
      kundeId: "k-extra",
      abrechnungsart: "Krankenkasse",
      betrag: 1000,
      mwstSatz: 0,
      status: "offen",
      datum: "2026-09-16",
      faelligkeit: "2026-09-30",
      positionen: [{ beschreibung: "Testfahrt", menge: 1, einzelpreis: 1000 }],
    };
    const rechnungen = [...INITIAL_RECHNUNGEN, extra];
    const mehr = computeFinanzKpis(rechnungen, {
      fahrer: [],
      fahrzeuge: [],
      auftraege: [],
      rechnungen,
      jetzt,
    }).umsatzMonat;
    expect(mehr).toBe(basis + 1000);
    expect(mehr).not.toBe(basis);
  });
});
