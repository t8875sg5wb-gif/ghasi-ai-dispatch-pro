import { describe, expect, it } from "bun:test";

import { computeKpis } from "@/lib/ai-brain";
import { computeFinanzKpis, INITIAL_RECHNUNGEN, type Rechnung } from "@/lib/finance";

describe("computeKpis Monatszahlen", () => {
  it("nutzt dieselbe Quelle wie computeFinanzKpis (keine Divergenz)", () => {
    const k = computeKpis();
    const fin = computeFinanzKpis();
    expect(k.umsatzMonat).toBe(fin.umsatzMonat);
    expect(k.gewinnMonat).toBe(fin.gewinnMonat);
    expect(k.margeProzent).toBe(fin.margeProzent);
  });

  it("ändert sich, wenn sich echte Rechnungsdaten ändern", () => {
    const basis = computeFinanzKpis().umsatzMonat;
    const extra: Rechnung = {
      ...INITIAL_RECHNUNGEN[0],
      id: "r-extra",
      nummer: "RE-2026-EXTRA",
      typ: "rechnung",
      status: "offen",
      betrag: 1000,
      mwstSatz: 0,
      mwstBetrag: undefined,
      zahlungen: undefined,
      bezahlterBetrag: undefined,
      positionen: [{ beschreibung: "Testfahrt", menge: 1, einzelpreis: 1000 }],
    };
    const mehr = computeFinanzKpis([...INITIAL_RECHNUNGEN, extra]).umsatzMonat;
    expect(mehr).toBe(basis + 1000);
    expect(mehr).not.toBe(basis);
  });
});
