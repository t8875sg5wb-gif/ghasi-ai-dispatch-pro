import { describe, expect, it } from "vitest";

import {
  aktionsFacetten,
  feldpfadFacetten,
  filtereAblehnungen,
  toggleWert,
} from "@/lib/ablehnungen-filter";
import type { DauerauftragAblehnung } from "@/lib/recurring-rejections.functions";

function eintrag(over: Partial<DauerauftragAblehnung>): DauerauftragAblehnung {
  return {
    id: over.id ?? "1",
    zeitpunkt: "2026-09-01T10:00:00.000Z",
    aktion: over.aktion ?? "create",
    zielId: over.zielId ?? null,
    patient: over.patient ?? null,
    grund: over.grund ?? "Ungültige Eingabe",
    felder: over.felder ?? [],
    suchfelder: over.suchfelder ?? { fahrer: null, kunde: null, traeger: null },
  };
}

const daten: DauerauftragAblehnung[] = [
  eintrag({
    id: "a",
    aktion: "create",
    patient: "A. M.",
    felder: [{ path: "terminzeit", label: "Uhrzeit Hinfahrt", message: "Format HH:mm" }],
    suchfelder: { fahrer: "Murat Yildiz", kunde: "AOK Bayern", traeger: "Klinikum Nord" },
  }),
  eintrag({
    id: "b",
    aktion: "update",
    felder: [{ path: "wochentage", label: "Wochentage", message: "Mindestens ein Tag" }],
    suchfelder: { fahrer: "Lena Kern", kunde: "TK", traeger: "Uniklinik Süd" },
  }),
];

describe("filtereAblehnungen", () => {
  it("findet Einträge über Fahrer, Kunde und Träger", () => {
    expect(filtereAblehnungen(daten, { suche: "murat", aktionen: [], feldpfade: [] })).toHaveLength(
      1,
    );
    expect(filtereAblehnungen(daten, { suche: "tk", aktionen: [], feldpfade: [] })[0]?.id).toBe("b");
    expect(
      filtereAblehnungen(daten, { suche: "klinikum nord", aktionen: [], feldpfade: [] })[0]?.id,
    ).toBe("a");
  });

  it("verknüpft mehrere Suchbegriffe mit UND", () => {
    expect(
      filtereAblehnungen(daten, { suche: "lena uniklinik", aktionen: [], feldpfade: [] }),
    ).toHaveLength(1);
    expect(
      filtereAblehnungen(daten, { suche: "lena klinikum", aktionen: [], feldpfade: [] }),
    ).toHaveLength(0);
  });

  it("filtert nach Aktionstyp und Feldpfad", () => {
    expect(
      filtereAblehnungen(daten, { suche: "", aktionen: ["update"], feldpfade: [] })[0]?.id,
    ).toBe("b");
    expect(
      filtereAblehnungen(daten, { suche: "", aktionen: [], feldpfade: ["terminzeit"] })[0]?.id,
    ).toBe("a");
    expect(
      filtereAblehnungen(daten, { suche: "", aktionen: ["create"], feldpfade: ["wochentage"] }),
    ).toHaveLength(0);
  });

  it("gibt ohne Filter alles zurück", () => {
    expect(filtereAblehnungen(daten, { suche: "", aktionen: [], feldpfade: [] })).toHaveLength(2);
  });
});

describe("Facetten", () => {
  it("zählt Aktionen und Feldpfade", () => {
    expect(aktionsFacetten(daten, (a) => a).map((f) => f.wert).sort()).toEqual([
      "create",
      "update",
    ]);
    expect(feldpfadFacetten(daten).map((f) => f.wert).sort()).toEqual([
      "terminzeit",
      "wochentage",
    ]);
    expect(feldpfadFacetten(daten)[0]?.anzahl).toBe(1);
  });

  it("toggleWert schaltet an und aus", () => {
    expect(toggleWert([], "x")).toEqual(["x"]);
    expect(toggleWert(["x"], "x")).toEqual([]);
  });
});
