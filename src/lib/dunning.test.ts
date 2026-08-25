import { describe, expect, it } from "bun:test";

import type { Rechnung } from "@/lib/finance";
import { buildMahnText } from "@/lib/dunning";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/company-settings-shared";

const company = DEFAULT_COMPANY_SETTINGS;

const rechnung = (patch: Partial<Rechnung> = {}): Rechnung => ({
  id: "r-test",
  nummer: "RE-2026-TEST",
  typ: "rechnung",
  kunde: "Musterkasse",
  kundeId: "k-test",
  abrechnungsart: "Krankenkasse",
  betrag: 320,
  mwstSatz: 0,
  status: "teilbezahlt",
  datum: "2026-06-01",
  faelligkeit: "2026-06-15",
  positionen: [{ beschreibung: "Fahrt", menge: 1, einzelpreis: 320 }],
  bezahlterBetrag: 160,
  ...patch,
});

describe("buildMahnText", () => {
  it("fordert bei unbezahlter Rechnung den vollen Bruttobetrag", () => {
    const r = rechnung({ status: "ueberfaellig", bezahlterBetrag: 0 });
    const text = buildMahnText(r, 1, company);
    expect(text).toContain("Offener Betrag:  320 €");
    expect(text).toContain("Gesamtbetrag:");
  });

  it("fordert bei teilbezahlter Rechnung den Restbetrag, nicht den Bruttobetrag", () => {
    const r = rechnung();
    const text = buildMahnText(r, 2, company);
    expect(text).toContain("Offener Betrag:  160 €");
    expect(text).not.toContain("Offener Betrag:  320 €");
    expect(text).toContain("Gesamtbetrag:    162,5 €");
  });

  it("berücksichtigt Zahlungen aus dem zahlungen-Array", () => {
    const r = rechnung({
      bezahlterBetrag: undefined,
      zahlungen: [{ datum: "2026-06-10", betrag: 200 }],
    });
    const text = buildMahnText(r, 1, company);
    expect(text).toContain("Offener Betrag:  120 €");
  });
});
