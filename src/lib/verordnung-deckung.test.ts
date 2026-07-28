// Regressionstests für die Deckungsprüfung (bun test).
import { describe, expect, test } from "bun:test";

import { pruefeDeckung, berlinTag, zeitstempel } from "@/lib/verordnung-deckung";
import type { Verordnung } from "@/lib/verordnungen-shared";

const V_ID = "11111111-1111-1111-1111-111111111111";

function verordnung(over: Partial<Verordnung> = {}): Verordnung {
  return {
    id: V_ID,
    patientId: "22222222-2222-2222-2222-222222222222",
    ausstellungsdatum: "2026-01-01",
    arztName: "",
    arztBsnr: "",
    arztLanr: "",
    transportart: "Sitzendtransport",
    hinRueckfahrt: false,
    istSerie: false,
    anzahlFaelligkeiten: null,
    seriengueltigVon: null,
    seriengueltigBis: null,
    genehmigtVonKasse: false,
    genehmigungsnummer: "",
    dokumentId: null,
    notiz: "",
    ...over,
  };
}

function auftrag(over: Partial<Parameters<typeof pruefeDeckung>[0]> = {}) {
  return {
    id: "a1",
    termin: "2026-03-10T08:00:00.000Z",
    transportart: "Sitzendtransport" as const,
    status: "neu" as const,
    verordnungId: V_ID,
    ...over,
  };
}

describe("pruefeDeckung – Grundfälle", () => {
  test("1. keine Verordnung → null", () => {
    expect(pruefeDeckung(auftrag(), null)).toBeNull();
  });

  test("2. undefined Verordnung → null", () => {
    expect(pruefeDeckung(auftrag(), undefined)).toBeNull();
  });

  test("3. passende Einzelverordnung → gedeckt", () => {
    expect(pruefeDeckung(auftrag(), verordnung())?.gedeckt).toBe(true);
  });

  test("4. Auftrag verweist auf andere Verordnung → nicht gedeckt", () => {
    const r = pruefeDeckung(auftrag({ verordnungId: "andere" }), verordnung());
    expect(r?.gedeckt).toBe(false);
    expect(r?.grund).toContain("nicht auf diese Verordnung");
  });

  test("5. Auftrag ohne verordnungId → nicht gedeckt", () => {
    expect(pruefeDeckung(auftrag({ verordnungId: null }), verordnung())?.gedeckt).toBe(false);
  });
});

describe("pruefeDeckung – Termin", () => {
  test("6. leerer Termin → nicht gedeckt, kein Throw", () => {
    const r = pruefeDeckung(auftrag({ termin: "" }), verordnung());
    expect(r?.gedeckt).toBe(false);
  });

  test("7. unparsbarer Termin → nicht gedeckt", () => {
    expect(pruefeDeckung(auftrag({ termin: "kein-datum" }), verordnung())?.gedeckt).toBe(false);
  });

  test("8. datetime-local Termin wird akzeptiert", () => {
    expect(pruefeDeckung(auftrag({ termin: "2026-03-10T08:00" }), verordnung())?.gedeckt).toBe(
      true,
    );
  });
});

describe("pruefeDeckung – Gültigkeitszeitraum", () => {
  const serie = verordnung({
    istSerie: true,
    anzahlFaelligkeiten: 3,
    seriengueltigVon: "2026-03-01",
    seriengueltigBis: "2026-03-31",
  });

  test("9. vor Beginn → nicht gedeckt", () => {
    const r = pruefeDeckung(auftrag({ termin: "2026-02-28T10:00:00Z" }), serie);
    expect(r?.gedeckt).toBe(false);
    expect(r?.grund).toContain("vor Beginn");
  });

  test("10. nach Ende → nicht gedeckt", () => {
    const r = pruefeDeckung(auftrag({ termin: "2026-04-01T10:00:00Z" }), serie);
    expect(r?.gedeckt).toBe(false);
    expect(r?.grund).toContain("nach Ende");
  });

  test("11. exakt am Startdatum → gedeckt (inklusive Grenze)", () => {
    expect(pruefeDeckung(auftrag({ termin: "2026-03-01T09:00:00Z" }), serie)?.gedeckt).toBe(true);
  });

  test("12. exakt am Enddatum → gedeckt (inklusive Grenze)", () => {
    expect(pruefeDeckung(auftrag({ termin: "2026-03-31T09:00:00Z" }), serie)?.gedeckt).toBe(true);
  });

  test("13. umgekehrter Zeitraum → nicht gedeckt", () => {
    const kaputt = verordnung({ seriengueltigVon: "2026-04-01", seriengueltigBis: "2026-03-01" });
    expect(pruefeDeckung(auftrag(), kaputt)?.gedeckt).toBe(false);
  });

  test("14. Berliner Kalendertag: 00:30 Ortszeit zählt zum selben Tag", () => {
    // 2026-03-31T22:30Z = 2026-04-01 00:30 Berliner Sommerzeit → außerhalb.
    const r = pruefeDeckung(auftrag({ termin: "2026-03-31T22:30:00Z" }), serie);
    expect(r?.gedeckt).toBe(false);
    expect(berlinTag(Date.parse("2026-03-31T22:30:00Z"))).toBe("2026-04-01");
  });
});

describe("pruefeDeckung – Transportart", () => {
  test("15. abweichende Transportart → nicht gedeckt", () => {
    const r = pruefeDeckung(auftrag({ transportart: "Liegendtransport" }), verordnung());
    expect(r?.gedeckt).toBe(false);
    expect(r?.grund).toContain("Transportart weicht ab");
  });
});

describe("pruefeDeckung – Serienzählung", () => {
  const serie = verordnung({ istSerie: true, anzahlFaelligkeiten: 2 });

  test("16. erste Fahrt der Serie → 1 von 2", () => {
    const r = pruefeDeckung(auftrag(), serie, []);
    expect(r?.gedeckt).toBe(true);
    expect(r?.verbraucht).toBe(1);
  });

  test("17. frühere Fahrten zählen, spätere nicht", () => {
    const alle = [
      auftrag({ id: "frueher", termin: "2026-03-01T08:00:00Z" }),
      auftrag({ id: "spaeter", termin: "2026-03-20T08:00:00Z" }),
    ];
    const r = pruefeDeckung(auftrag(), serie, alle);
    expect(r?.verbraucht).toBe(2);
    expect(r?.gedeckt).toBe(true);
  });

  test("18. dritte Fahrt überschreitet die Genehmigung", () => {
    const alle = [
      auftrag({ id: "f1", termin: "2026-03-01T08:00:00Z" }),
      auftrag({ id: "f2", termin: "2026-03-02T08:00:00Z" }),
    ];
    const r = pruefeDeckung(auftrag(), serie, alle);
    expect(r?.gedeckt).toBe(false);
    expect(r?.verbraucht).toBe(3);
  });

  test("19. stornierte Fahrten und Fremdverordnungen zählen nicht", () => {
    const alle = [
      auftrag({ id: "f1", termin: "2026-03-01T08:00:00Z", status: "storniert" }),
      auftrag({ id: "f2", termin: "2026-03-02T08:00:00Z", verordnungId: "fremd" }),
      auftrag({ id: "f3", termin: "2026-03-03T08:00:00Z" }),
    ];
    expect(pruefeDeckung(auftrag(), serie, alle)?.verbraucht).toBe(2);
  });

  test("20. der geprüfte Auftrag zählt genau einmal (auch wenn in der Liste)", () => {
    const aktuell = auftrag();
    const alle = [aktuell, auftrag({ id: "f1", termin: "2026-03-01T08:00:00Z" })];
    expect(pruefeDeckung(aktuell, serie, alle)?.verbraucht).toBe(2);
  });

  test("21. ungültige Termine anderer Aufträge werden ignoriert", () => {
    const alle = [auftrag({ id: "kaputt", termin: "" })];
    expect(pruefeDeckung(auftrag(), serie, alle)?.verbraucht).toBe(1);
  });

  test("22. Serie ohne Anzahl → gedeckt ohne Zählung", () => {
    const ohne = verordnung({ istSerie: true, anzahlFaelligkeiten: null });
    const r = pruefeDeckung(auftrag(), ohne);
    expect(r?.gedeckt).toBe(true);
    expect(r?.verbraucht).toBeUndefined();
  });
});

describe("zeitstempel", () => {
  test("23. null/leer/ungültig → null", () => {
    expect(zeitstempel(null)).toBeNull();
    expect(zeitstempel("")).toBeNull();
    expect(zeitstempel("foo")).toBeNull();
  });
});
