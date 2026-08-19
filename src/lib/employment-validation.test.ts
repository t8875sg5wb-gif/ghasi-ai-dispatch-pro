// Tests für Beschäftigungsverhältnisse: Ein-Betrag-Regel, Zeitraum, Patch-Semantik.
import { describe, expect, test } from "bun:test";

import {
  beschaeftigungToRow,
  createEmploymentSchema,
  mapEmploymentDbError,
  updateEmploymentSchema,
} from "@/lib/employment-shared";

const FAHRER = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";

describe("createEmploymentSchema", () => {
  test("Stundenlohn allein ist gültig", () => {
    const r = createEmploymentSchema.safeParse({
      fahrerId: FAHRER,
      verguetungsart: "stundenlohn",
      stundenlohn: 15.5,
      monatsbrutto: null,
      gueltigAb: "2026-01-01",
    });
    expect(r.success).toBe(true);
  });

  test("Monatsbrutto allein ist gültig", () => {
    const r = createEmploymentSchema.safeParse({
      fahrerId: FAHRER,
      verguetungsart: "monatsbrutto",
      monatsbrutto: 2400,
      gueltigAb: "2026-01-01",
      gueltigBis: "2026-12-31",
    });
    expect(r.success).toBe(true);
  });

  test("beides gleichzeitig wird abgewiesen", () => {
    const r = createEmploymentSchema.safeParse({
      fahrerId: FAHRER,
      verguetungsart: "stundenlohn",
      stundenlohn: 15,
      monatsbrutto: 2400,
      gueltigAb: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });

  test("fehlender Betrag wird abgewiesen (kein Raten, keine Vorbelegung)", () => {
    const r = createEmploymentSchema.safeParse({
      fahrerId: FAHRER,
      verguetungsart: "monatsbrutto",
      gueltigAb: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });

  test("Betrag zur falschen Vergütungsart wird abgewiesen", () => {
    const r = createEmploymentSchema.safeParse({
      fahrerId: FAHRER,
      verguetungsart: "monatsbrutto",
      stundenlohn: 15,
      gueltigAb: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });

  test("Enddatum vor Startdatum wird abgewiesen", () => {
    const r = createEmploymentSchema.safeParse({
      fahrerId: FAHRER,
      verguetungsart: "stundenlohn",
      stundenlohn: 15,
      gueltigAb: "2026-05-01",
      gueltigBis: "2026-04-30",
    });
    expect(r.success).toBe(false);
  });

  test("Status/Version vom Client werden abgewiesen (.strict)", () => {
    const r = createEmploymentSchema.safeParse({
      fahrerId: FAHRER,
      verguetungsart: "stundenlohn",
      stundenlohn: 15,
      gueltigAb: "2026-01-01",
      status: "verifiziert",
      version: 9,
    });
    expect(r.success).toBe(false);
  });
});

describe("updateEmploymentSchema", () => {
  test("vollständiger Satz ist gültig", () => {
    const r = updateEmploymentSchema.safeParse({
      id: ID,
      values: {
        fahrerId: FAHRER,
        verguetungsart: "stundenlohn",
        stundenlohn: 16,
        gueltigAb: "2026-02-01",
        gueltigBis: null,
      },
    });
    expect(r.success).toBe(true);
  });

  test("beides gleichzeitig wird auch bei Änderung abgewiesen", () => {
    const r = updateEmploymentSchema.safeParse({
      id: ID,
      values: {
        fahrerId: FAHRER,
        verguetungsart: "monatsbrutto",
        monatsbrutto: 2400,
        stundenlohn: 16,
        gueltigAb: "2026-02-01",
      },
    });
    expect(r.success).toBe(false);
  });
});

describe("beschaeftigungToRow – Patch-Semantik", () => {
  test("ausgelassene Felder erzeugen keinen Schlüssel", () => {
    const row = beschaeftigungToRow({ notiz: "nur Notiz" });
    expect(Object.keys(row)).toEqual(["notiz"]);
  });

  test("explizites null wird geschrieben", () => {
    const row = beschaeftigungToRow({ gueltigBis: null, monatsbrutto: null });
    expect(row).toEqual({ gueltig_bis: null, monatsbrutto: null });
  });
});

describe("mapEmploymentDbError", () => {
  test("Überschneidung liefert eine fachliche Meldung", () => {
    const msg = mapEmploymentDbError(
      'conflicting key value violates exclusion constraint "employment_no_overlap_verified"',
    );
    expect(msg).toContain("Überschneidung");
  });

  test("unbekannte Fehler geben keine SQL-Details preis", () => {
    const msg = mapEmploymentDbError('syntax error at or near "SELECT" in relation foo');
    expect(msg).toBe("Die Änderung konnte nicht gespeichert werden.");
  });
});
