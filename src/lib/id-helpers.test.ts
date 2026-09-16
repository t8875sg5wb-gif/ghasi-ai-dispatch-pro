import { describe, expect, test } from "bun:test";

import { idOderNull } from "@/lib/id-helpers";
import { rowToAusgabe, type ExpenseRow } from "@/lib/expenses-shared";
import { rowToPatient, type PatientRow } from "@/lib/patients-shared";
import { rowToDauerauftrag, type RecurringRow } from "@/lib/recurring-shared";
import { rowToVerordnung, type VerordnungRow } from "@/lib/verordnungen-shared";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("nullable ID-Normalisierung", () => {
  test("normalisiert null, Leerstring und Whitespace, aber keine echte ID", () => {
    expect(idOderNull(null)).toBeNull();
    expect(idOderNull(undefined)).toBeNull();
    expect(idOderNull("")).toBeNull();
    expect(idOderNull("   ")).toBeNull();
    expect(idOderNull(UUID)).toBe(UUID);
  });

  test("Ausgaben normalisieren Fahrer- und Fahrzeug-Fremdschluessel", () => {
    const row = {
      id: UUID,
      datum: "2026-09-15",
      kategorie: "Kraftstoff",
      lieferant: "Test",
      betrag_brutto: 10,
      ust_satz: 19,
      fahrzeug_id: "",
      fahrer_id: "   ",
      notiz: null,
      beleg_dokument_id: null,
      created_at: "2026-09-15T00:00:00Z",
    } as ExpenseRow;
    const mapped = rowToAusgabe(row);
    expect(mapped.fahrzeugId).toBeNull();
    expect(mapped.fahrerId).toBeNull();
  });

  test("Patient normalisiert den UUID-Kostentraeger", () => {
    const row = {
      id: UUID,
      name: "Test",
      telefon: null,
      mobilitaet: "Gehfähig",
      kostentraeger: "",
      hinweis: "",
      begleitperson: false,
      medizinische_notiz: null,
      patientennotiz: null,
      kostentraeger_id: "",
      versichertennummer: null,
      zuzahlungsbefreit: false,
      zuzahlungsbefreit_bis: null,
      verordnung_vorhanden: false,
      verordnung_dokument_id: "legacy-document-key",
      genehmigung_bis: null,
    } as PatientRow;
    const mapped = rowToPatient(row);
    expect(mapped.kostentraegerId).toBeNull();
    expect(mapped.verordnungDokumentId).toBe("legacy-document-key");
  });

  test("Dauerauftrag normalisiert alle vier nullable UUID-Verknuepfungen", () => {
    const row = {
      id: UUID,
      kennung: "DA-T",
      patient: "Test",
      patient_id: "",
      insurer_id: " ",
      abholort: "A",
      zielort: "B",
      terminzeit: "08:00",
      rueckfahrt: false,
      rueckfahrtzeit: null,
      mobilitaet: "gehfaehig",
      begleitperson: false,
      verordnung_erforderlich: false,
      kostentraeger: "",
      krankenkasse: "",
      bevorzugtes_fahrzeug: null,
      bevorzugter_fahrer: null,
      bevorzugter_fahrer_id: "",
      bevorzugtes_fahrzeug_id: "   ",
      notiz: "",
      medizinische_notiz: "",
      kategorie: "sonstige",
      rhythmus: "woechentlich",
      wochentage: [],
      start_datum: "2026-09-15",
      end_datum: null,
      pausiert: false,
      pause_von: null,
      pause_bis: null,
      feiertage_ueberspringen: true,
      uebersprungene_termine: [],
      generierte_termine: [],
      created_at: "2026-09-15T00:00:00Z",
    } as RecurringRow;
    const mapped = rowToDauerauftrag(row);
    expect([
      mapped.patientId,
      mapped.insurerId,
      mapped.bevorzugterFahrerId,
      mapped.bevorzugtesFahrzeugId,
    ]).toEqual([null, null, null, null]);
  });

  test("Verordnung normalisiert leere Patienten-ID", () => {
    const row = {
      id: UUID,
      patient_id: " ",
      ausstellungsdatum: "2026-09-15",
      arzt_name: "",
      arzt_bsnr: "",
      arzt_lanr: "",
      transportart: "Sitzendtransport",
      hin_rueckfahrt: false,
      ist_serie: false,
      anzahl_faelligkeiten: null,
      seriengueltig_von: null,
      seriengueltig_bis: null,
      genehmigt_von_kasse: false,
      genehmigungsnummer: null,
      dokument_id: null,
      notiz: null,
    } as VerordnungRow;
    expect(rowToVerordnung(row).patientId).toBeNull();
  });
});
