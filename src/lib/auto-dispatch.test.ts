import { describe, it, expect } from "bun:test";
import { berechneAutoDispatchVorschlaege } from "@/lib/auto-dispatch";
import { SEED_FAHRER } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import type { DispatchTransport } from "@/lib/dispatch";

const verfuegbarerFahrer = { ...SEED_FAHRER[0], status: "verfuegbar" as const };
const verfuegbaresFahrzeug = { ...INITIAL_FAHRZEUGE[0], status: "frei" as const };

function makeTransport(overrides: Partial<DispatchTransport> & { id: string }): DispatchTransport {
  return {
    id: overrides.id,
    nummer: `T-${overrides.id}`,
    patient: "Max Mustermann",
    transportart: "Sitzend",
    prioritaet: "normal",
    status: "neu",
    abholort: "Minden",
    zielort: "Bielefeld",
    termin: "2026-08-21T08:00:00Z",
    fahrer: null,
    fahrzeug: null,
    kostentraeger: "AOK",
    notiz: "",
    liveStatus: "geplant",
    abholzeit: "08:00",
    ankunftzeit: "09:00",
    distanzKm: 42,
    leerKm: 8,
    verspaetungMin: 0,
    wiederkehrend: false,
    erloes: 0,
    rollstuhl: false,
    liegend: false,
    ...overrides,
  } as DispatchTransport;
}

describe("berechneAutoDispatchVorschlaege", () => {
  it("returns proposals for open, unassigned transports", () => {
    const transporte: DispatchTransport[] = [
      makeTransport({ id: "offen-1" }),
      makeTransport({ id: "offen-2" }),
    ];

    const vorschlaege = berechneAutoDispatchVorschlaege(
      transporte,
      [verfuegbarerFahrer],
      [verfuegbaresFahrzeug],
    );

    expect(vorschlaege.length).toBe(2);
    expect(vorschlaege.map((v) => v.transport.id)).toEqual(["offen-1", "offen-2"]);
    expect(vorschlaege[0].fahrer.id).toBe(verfuegbarerFahrer.id);
    expect(vorschlaege[0].patch.fahrerId).toBe(verfuegbarerFahrer.id);
    expect(vorschlaege[0].patch.liveStatus).toBe("fahrzeug_zugewiesen");
    expect(vorschlaege[0].gesamtScore).toBeGreaterThan(0);
    expect(vorschlaege[0].erklaerung.length).toBeGreaterThan(0);
  });

  it("skips completed, cancelled and fully assigned transports", () => {
    const transporte: DispatchTransport[] = [
      makeTransport({ id: "offen", liveStatus: "geplant" }),
      makeTransport({ id: "abgeschlossen", liveStatus: "abgeschlossen" }),
      makeTransport({ id: "storniert", liveStatus: "storniert" }),
      makeTransport({
        id: "zugewiesen",
        liveStatus: "fahrzeug_zugewiesen",
        fahrer: "M. Keller",
        fahrzeug: "MI-KT 142",
      }),
    ];

    const vorschlaege = berechneAutoDispatchVorschlaege(
      transporte,
      [verfuegbarerFahrer],
      [verfuegbaresFahrzeug],
    );

    expect(vorschlaege.length).toBe(1);
    expect(vorschlaege[0].transport.id).toBe("offen");
  });

  it("returns an empty array when no driver matches", () => {
    const transporte: DispatchTransport[] = [makeTransport({ id: "offen" })];
    const vorschlaege = berechneAutoDispatchVorschlaege(transporte, [], [verfuegbaresFahrzeug]);
    expect(vorschlaege.length).toBe(0);
  });

  it("does not mutate the input arrays or transports", () => {
    const transporte: DispatchTransport[] = [makeTransport({ id: "offen" })];
    const original = JSON.stringify(transporte);

    berechneAutoDispatchVorschlaege(transporte, [verfuegbarerFahrer], [verfuegbaresFahrzeug]);

    expect(JSON.stringify(transporte)).toBe(original);
  });
});
