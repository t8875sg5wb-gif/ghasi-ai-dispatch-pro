import { describe, it, expect } from "bun:test";
import { transporteFuerPatient } from "./patienten";
import type { Auftrag } from "@/lib/auftraege";
import type { Patient } from "@/lib/stammdaten";

describe("transporteFuerPatient", () => {
  it("ordnet Transporte ausschließlich über patientId zu, nicht über den Namen", () => {
    const patientA: Patient = {
      id: "p-anna-schmidt-1",
      name: "Anna Schmidt",
      telefon: "",
      mobilitaet: "Gehfähig",
      kostentraeger: "AOK",
      hinweis: "",
      begleitperson: false,
      kostentraegerId: null,
      versichertennummer: null,
      zuzahlungsbefreit: false,
      zuzahlungsbefreitBis: null,
      verordnungVorhanden: false,
      verordnungDokumentId: null,
      genehmigungBis: null,
    };

    const patientB: Patient = {
      ...patientA,
      id: "p-anna-schmidt-2",
    };

    const auftraege: Pick<Auftrag, "id" | "patientId" | "patient">[] = [
      { id: "t-a", patientId: patientA.id, patient: patientA.name },
      { id: "t-b", patientId: patientB.id, patient: patientB.name },
      { id: "t-freitext", patientId: null, patient: patientA.name },
    ];

    const fuerA = transporteFuerPatient(patientA, auftraege);
    const fuerB = transporteFuerPatient(patientB, auftraege);

    expect(fuerA.map((a) => a.id)).toEqual(["t-a"]);
    expect(fuerB.map((a) => a.id)).toEqual(["t-b"]);
  });
});
