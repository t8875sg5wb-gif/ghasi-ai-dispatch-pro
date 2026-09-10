// Prüft, dass die aus dem OpenAPI-Schema generierten Client-Typen und der
// Fehler-Parser für createRecurring/updateRecurring korrekt zusammenspielen.
import { describe, expect, it } from "bun:test";

import {
  FELDFEHLER_MARKER,
  apiFeldLabel,
  istFeldFehlerAntwort,
  parseRecurringFehler,
} from "@/lib/api/dauerauftraege";
import type { ApiFeldFehler, RecurringApiFehler } from "@/lib/api/dauerauftraege";
import { kodiereFeldFehler } from "@/lib/recurring-validation";

const FELDER: ApiFeldFehler[] = [
  { path: "patient", label: "Patientenname", message: "Bitte den Namen des Patienten angeben." },
  {
    path: "wochentage",
    label: "Wochentage",
    message: "Bei wöchentlichem Rhythmus mindestens einen Wochentag wählen.",
  },
];

describe("Dauerauftrags-API-Fehlertypen", () => {
  it("erkennt eine kodierte Feldfehler-Antwort", () => {
    const message = kodiereFeldFehler("Ungültige Dauerauftragsdaten.", FELDER);
    expect(message).toContain(FELDFEHLER_MARKER);
    expect(istFeldFehlerAntwort({ message })).toBe(true);
    expect(istFeldFehlerAntwort({ message: "Patient nicht gefunden." })).toBe(false);
    expect(istFeldFehlerAntwort(null)).toBe(false);
  });

  it("parst Feldfehler typisiert inklusive Pfad-Map", () => {
    const fehler = parseRecurringFehler(
      new Error(kodiereFeldFehler("Ungültige Dauerauftragsdaten.", FELDER)),
    );
    expect(fehler.art).toBe("feldfehler");
    if (fehler.art !== "feldfehler") throw new Error("unerwartet");
    expect(fehler.fields).toEqual(FELDER);
    expect(fehler.nachPfad["patient"]).toBe("Bitte den Namen des Patienten angeben.");
    expect(fehler.text).not.toContain(FELDFEHLER_MARKER);
  });

  it("liefert für fachliche Fehler ohne Feldliste den Typ 'fachlich'", () => {
    const fehler: RecurringApiFehler = parseRecurringFehler(new Error("Patient nicht gefunden."));
    expect(fehler).toEqual({ art: "fachlich", text: "Patient nicht gefunden." });
  });

  it("löst Labels über die gemeinsame Label-Tabelle auf", () => {
    expect(apiFeldLabel("patient")).toBe("Patientenname");
    expect(apiFeldLabel("gibtesnicht")).toBe("gibtesnicht");
  });
});
