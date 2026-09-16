import { describe, expect, it } from "bun:test";

import { SEED_FAHRER } from "@/lib/fahrer";
import { erkenneKonflikte, type DispatchTransport } from "@/lib/dispatch";

function transport(
  id: string,
  fahrerId: string,
  fahrerName: string,
  abholzeit: string,
  ankunftzeit: string,
): DispatchTransport {
  return {
    id,
    nummer: `T-${id}`,
    patient: "Synthetischer Patient",
    transportart: "Sitzend",
    prioritaet: "normal",
    status: "disponiert",
    abholort: "Minden",
    zielort: "Bad Oeynhausen",
    termin: "2026-09-16T08:00:00Z",
    fahrerId,
    fahrer: fahrerName,
    fahrzeug: null,
    kostentraeger: "Test",
    notiz: "",
    liveStatus: "fahrer_zugewiesen",
    abholzeit,
    ankunftzeit,
    distanzKm: 10,
    leerKm: 2,
    verspaetungMin: 0,
    wiederkehrend: false,
    erloes: 100,
    rollstuhl: false,
    liegend: false,
  } as DispatchTransport;
}

const basisA = { ...SEED_FAHRER[0], status: "verfuegbar" as const };
const basisB = { ...SEED_FAHRER[1], status: "verfuegbar" as const };

describe("Dispatch Fahrer-Identität", () => {
  it("erzeugt bei zwei gleichnamigen Fahrern mit unterschiedlichen IDs keine falsche Doppelbuchung", () => {
    const name = "Gleicher Anzeigename";
    const fahrerA = { ...basisA, id: "fahrer-a", name };
    const fahrerB = { ...basisB, id: "fahrer-b", name };
    const konflikte = erkenneKonflikte(
      [
        transport("a", fahrerA.id, name, "08:00", "09:00"),
        transport("b", fahrerB.id, name, "08:30", "09:30"),
      ],
      [fahrerA, fahrerB],
      [],
    );
    expect(konflikte.filter((k) => k.typ === "doppelbuchung")).toHaveLength(0);
  });

  it("erkennt eine echte Doppelbuchung über dieselbe Fahrer-ID trotz abweichender Anzeigenamen", () => {
    const fahrer = { ...basisA, id: "fahrer-eins", name: "Aktueller Name" };
    const konflikte = erkenneKonflikte(
      [
        transport("a", fahrer.id, "Alter Anzeigename", "08:00", "09:00"),
        transport("b", fahrer.id, "Aktueller Name", "08:30", "09:30"),
      ],
      [fahrer],
      [],
    );

    const doppel = konflikte.filter((k) => k.typ === "doppelbuchung");
    expect(doppel).toHaveLength(1);
    expect(doppel[0]?.transportId).toBe("b");
  });

  it("prüft Verfügbarkeit anhand der ID und nicht anhand eines gleichlautenden Namens", () => {
    const name = "Gleicher Anzeigename";
    const verfuegbar = { ...basisA, id: "fahrer-ok", name, status: "verfuegbar" as const };
    const gesperrt = { ...basisB, id: "fahrer-gesperrt", name, status: "krank" as const };
    const konflikte = erkenneKonflikte(
      [transport("a", verfuegbar.id, name, "08:00", "09:00")],
      [gesperrt, verfuegbar],
      [],
    );
    expect(konflikte.some((k) => k.typ === "fahrer_nicht_verfuegbar")).toBe(false);
  });
});
