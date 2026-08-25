import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  dekodiereFeldFehler,
  feldFehlerMap,
  feldLabel,
  kodiereFeldFehler,
  lesbarerFehlerText,
  pruefeDauerauftragRegeln,
  zuFeldFehlern,
} from "@/lib/recurring-validation";

describe("Dauerauftrag-Feldfehler", () => {
  it("mappt Zod-Fehler auf Pfad, Label und Meldung", () => {
    const schema = z.object({ terminzeit: z.string().regex(/^\d{2}:\d{2}$/, "Uhrzeit HH:mm") });
    const res = schema.safeParse({ terminzeit: "8 Uhr" });
    const felder = zuFeldFehlern((res as { error: z.ZodError }).error);
    expect(felder).toHaveLength(1);
    expect(felder[0].path).toBe("terminzeit");
    expect(felder[0].label).toBe("Uhrzeit Hinfahrt");
    expect(felder[0].message).toContain("Uhrzeit");
  });

  it("entfernt den values-Präfix bei Teil-Updates", () => {
    const schema = z.object({ values: z.object({ patient: z.string().min(1) }) });
    const res = schema.safeParse({ values: { patient: "" } });
    expect(zuFeldFehlern((res as { error: z.ZodError }).error)[0].path).toBe("patient");
  });

  it("kodiert und dekodiert die strukturierte Liste verlustfrei", () => {
    const felder = [{ path: "endDatum", label: feldLabel("endDatum"), message: "zu früh" }];
    const msg = kodiereFeldFehler("Ungültige Dauerauftragsdaten.", felder);
    expect(lesbarerFehlerText(msg)).toContain("Enddatum: zu früh");
    expect(dekodiereFeldFehler(msg)).toEqual(felder);
    expect(feldFehlerMap(dekodiereFeldFehler(msg))["endDatum"]).toBe("zu früh");
  });

  it("liefert leere Liste bei Meldungen ohne Feldfehler", () => {
    expect(dekodiereFeldFehler("Netzwerkfehler")).toEqual([]);
  });
});

describe("pruefeDauerauftragRegeln", () => {
  const gueltig = {
    patient: "Anna Berg",
    pickup: { street: "Hauptstr.", houseNumber: "1", postalCode: "10115", city: "Berlin" },
    destination: { street: "Klinikweg", houseNumber: "9", postalCode: "10117", city: "Berlin" },
    rhythmus: "woechentlich",
    wochentage: [1, 3],
    rueckfahrt: false,
    startDatum: "2026-09-01",
    endDatum: "2026-12-31",
  };

  it("akzeptiert vollständige Daten", () => {
    expect(pruefeDauerauftragRegeln(gueltig, true)).toEqual([]);
  });

  it("meldet fehlende Pflichtangaben feldgenau", () => {
    const felder = pruefeDauerauftragRegeln(
      { ...gueltig, patient: "  ", destination: null, wochentage: [] },
      true,
    );
    expect(felder.map((f) => f.path).sort()).toEqual(["destination", "patient", "wochentage"]);
  });

  it("verlangt eine Rückfahrtzeit bei aktivierter Rückfahrt", () => {
    const felder = pruefeDauerauftragRegeln({ ...gueltig, rueckfahrt: true }, true);
    expect(felder[0].path).toBe("rueckfahrtzeit");
  });

  it("prüft Datumsreihenfolge von Ende und Pause", () => {
    const felder = pruefeDauerauftragRegeln(
      { ...gueltig, endDatum: "2026-08-01", pauseVon: "2026-10-05", pauseBis: "2026-10-01" },
      true,
    );
    expect(felder.map((f) => f.path)).toEqual(["endDatum", "pauseBis"]);
  });

  it("überspringt Pflichtprüfungen bei Teil-Updates", () => {
    expect(pruefeDauerauftragRegeln({ notiz: "x" } as never, false)).toEqual([]);
    expect(pruefeDauerauftragRegeln({ patient: "" }, false)[0].path).toBe("patient");
  });
});
