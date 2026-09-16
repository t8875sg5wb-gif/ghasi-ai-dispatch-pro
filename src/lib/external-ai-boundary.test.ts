import { describe, expect, test } from "bun:test";
import {
  buildExternalAiSnapshot,
  containsKnownPersonName,
  containsPotentialSensitiveData,
  filterExternalAiBusinessTools,
} from "@/lib/external-ai-boundary";

describe("externe KI-Datengrenze", () => {
  test("gibt nur ausdrücklich erlaubte Business-Tools frei", () => {
    const filtered = filterExternalAiBusinessTools({
      kennzahlen_abrufen: 1,
      prognosen_abrufen: 2,
      aktion_vorbereiten: 3,
      patienten_abrufen: 4,
      transporte_abrufen: 5,
      live_gps_abrufen: 6,
      rechnungen_abrufen: 7,
    });
    expect(Object.keys(filtered).sort()).toEqual([
      "aktion_vorbereiten",
      "kennzahlen_abrufen",
      "prognosen_abrufen",
    ]);
  });

  test("erkennt bekannte Personen ohne Groß-/Kleinschreibungsabhängigkeit", () => {
    expect(containsKnownPersonName("Bitte prüfe MAX MUSTERMANN", ["Max Mustermann"])).toBe(true);
    expect(containsKnownPersonName("Wie ist die Auslastung heute?", ["Max Mustermann"])).toBe(
      false,
    );
  });

  test("blockiert typische personenbezogene und sensible Eingaben", () => {
    expect(containsPotentialSensitiveData("mail: max@example.de")).toBe(true);
    expect(containsPotentialSensitiveData("Telefon 0571 1234567")).toBe(true);
    expect(containsPotentialSensitiveData("Musterstraße 12")).toBe(true);
    expect(containsPotentialSensitiveData("Patient braucht einen Rollstuhl")).toBe(true);
    expect(containsPotentialSensitiveData("Wie hoch ist der Mindestlohn 2026?")).toBe(false);
  });

  test("ohne privilegrierten Datenpfad bleibt nur die Entwurfsfunktion extern verfügbar", () => {
    const filtered = filterExternalAiBusinessTools(
      { kennzahlen_abrufen: 1, prognosen_abrufen: 2, aktion_vorbereiten: 3 },
      false,
    );
    expect(Object.keys(filtered)).toEqual(["aktion_vorbereiten"]);
  });

  test("Snapshot enthält keine Rohdaten und dokumentiert die Grenze", () => {
    const snapshot = buildExternalAiSnapshot("admin", false);
    expect(snapshot).toContain("keine Patienten-, Fahrer-, GPS-, Rechnungs-, Dokument-");
    expect(snapshot).toContain("nicht konfiguriert");
    expect(snapshot).toContain("Langzeitgedächtnis");
    expect(snapshot).not.toContain("Max Mustermann");
  });
});
