import { describe, expect, it } from "bun:test";

import {
  createFaktSchema,
  createRegelSchema,
  genauEinRegelWert,
  lohnFaktToRow,
  lohnRegelToRow,
  mapPayrollDbError,
  updateRegelSchema,
} from "@/lib/payroll-shared";

const FAHRER = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";

const faktBasis = {
  fahrerId: FAHRER,
  faktSchluessel: "steuerklasse",
  wert: "III",
  gueltigAb: "2026-01-01",
};

const regelBasis = {
  kennung: "kv_arbeitgeber",
  bezeichnung: "Krankenversicherung Arbeitgeberanteil",
  kategorie: "arbeitgeberkosten" as const,
  berechnungsart: "prozent" as const,
  prozentsatz: 7.3,
  gueltigAb: "2026-01-01",
  quelle: "§ 249 SGB V",
  quelleVersion: "Stand 2026-01-01",
};

describe("Lohn-Eingabefakten – Validierung", () => {
  it("akzeptiert einen vollständigen Fakt", () => {
    expect(createFaktSchema.safeParse(faktBasis).success).toBe(true);
  });

  it("lehnt ungültige Fakten-Schlüssel ab", () => {
    expect(
      createFaktSchema.safeParse({ ...faktBasis, faktSchluessel: "Steuer Klasse" }).success,
    ).toBe(false);
  });

  it("lehnt leere Werte ab (nichts wird geraten)", () => {
    expect(createFaktSchema.safeParse({ ...faktBasis, wert: "   " }).success).toBe(false);
  });

  it("lehnt Enddatum vor Startdatum ab", () => {
    expect(createFaktSchema.safeParse({ ...faktBasis, gueltigBis: "2025-12-31" }).success).toBe(
      false,
    );
  });

  it("lehnt unbekannte Felder ab (.strict)", () => {
    expect(createFaktSchema.safeParse({ ...faktBasis, status: "verifiziert" }).success).toBe(false);
  });

  it("Mapper: ausgelassene Felder erzeugen keinen Schlüssel", () => {
    const row = lohnFaktToRow({ wert: "I" });
    expect(Object.keys(row)).toEqual(["wert"]);
  });

  it("Mapper: explizites null wird geschrieben", () => {
    expect(lohnFaktToRow({ gueltigBis: null })).toEqual({ gueltig_bis: null });
  });
});

describe("Lohn-Regelwerke – Validierung", () => {
  it("akzeptiert eine vollständige Prozent-Regel", () => {
    expect(createRegelSchema.safeParse(regelBasis).success).toBe(true);
  });

  it("verlangt eine Quellenangabe", () => {
    const ohneQuelle = { ...regelBasis, quelle: "" };
    expect(createRegelSchema.safeParse(ohneQuelle).success).toBe(false);
  });

  it("verlangt eine Quellen-Version", () => {
    expect(createRegelSchema.safeParse({ ...regelBasis, quelleVersion: "" }).success).toBe(false);
  });

  it("lehnt beide Werte gleichzeitig ab", () => {
    expect(createRegelSchema.safeParse({ ...regelBasis, festbetrag: 100 }).success).toBe(false);
  });

  it("lehnt fehlenden Wert ab (keine Vorbelegung)", () => {
    const { prozentsatz: _weg, ...ohneWert } = regelBasis;
    expect(createRegelSchema.safeParse(ohneWert).success).toBe(false);
  });

  it("akzeptiert eine Festbetrag-Regel", () => {
    const fest = {
      ...regelBasis,
      berechnungsart: "festbetrag" as const,
      prozentsatz: null,
      festbetrag: 25.5,
    };
    expect(createRegelSchema.safeParse(fest).success).toBe(true);
  });

  it("prüft die Ein-Wert-Regel isoliert", () => {
    expect(genauEinRegelWert({ berechnungsart: "prozent", prozentsatz: 1 })).toBe(true);
    expect(genauEinRegelWert({ berechnungsart: "prozent", festbetrag: 1 })).toBe(false);
    expect(genauEinRegelWert({ berechnungsart: "festbetrag", festbetrag: 0 })).toBe(false);
    expect(genauEinRegelWert({})).toBe(false);
  });

  it("Update verlangt vollständige Werte inkl. Quelle", () => {
    expect(updateRegelSchema.safeParse({ id: ID, values: regelBasis }).success).toBe(true);
    expect(
      updateRegelSchema.safeParse({ id: ID, values: { ...regelBasis, quelle: "" } }).success,
    ).toBe(false);
  });

  it("Mapper: Patch-Semantik ohne Fallbacks", () => {
    expect(Object.keys(lohnRegelToRow({ notiz: "x" }))).toEqual(["notiz"]);
    expect(lohnRegelToRow({ festbetrag: null })).toEqual({ festbetrag: null });
  });
});

describe("Fehler-Mapping", () => {
  it("übersetzt Überschneidungen ohne SQL-Details", () => {
    expect(
      mapPayrollDbError(
        'conflicting key value violates exclusion constraint "payroll_rules_no_overlap_verified"',
      ),
    ).toContain("Kennung");
    expect(mapPayrollDbError("payroll_facts_no_overlap_verified")).toContain("Fakten-Schlüssel");
  });

  it("übersetzt Selbstverifizierung", () => {
    expect(
      mapPayrollDbError("Eine Lohnregel muss von einer zweiten berechtigten Person …"),
    ).toContain("zweiten berechtigten Person");
  });
});
