import { describe, expect, it } from "bun:test";
import { fahrerHinweise, fahrzeugHinweise, tageBis } from "@/lib/ghasi-hinweise";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import type { Fahrer } from "@/lib/fahrer";

const inTagen = (tage: number) =>
  new Date(Date.now() + tage * 86_400_000).toISOString().slice(0, 10);

const basisFahrzeug = () => ({
  ...INITIAL_FAHRZEUGE[0]!,
  id: "test-kfz",
  kennzeichen: "TEST-1",
  status: "verfuegbar" as const,
  tankstand: 90,
  tuevBis: inTagen(400),
  versicherungBis: inTagen(400),
  naechsteWartung: inTagen(400),
  leasingEnde: inTagen(400),
});

const basisFahrer = (): Fahrer =>
  ({
    id: "test-fahrer",
    name: "Test Fahrer",
    ueberstunden: 0,
    fuehrerschein: { gueltigBis: inTagen(400) },
    pSchein: { gueltigBis: inTagen(400) },
    ersteHilfe: { gueltigBis: inTagen(400) },
    pScheinGueltigBis: inTagen(400),
    fuehrungszeugnisDatum: inTagen(-30),
    svAusweisVorhanden: true,
    steuerId: "12345678901",
  }) as Fahrer;

describe("tageBis", () => {
  it("liefert null bei leerem oder ungültigem Datum", () => {
    expect(tageBis("")).toBeNull();
    expect(tageBis(null)).toBeNull();
    expect(tageBis(undefined)).toBeNull();
    expect(tageBis("kein-datum")).toBeNull();
  });

  it("liefert eine Zahl bei gültigem Datum", () => {
    expect(tageBis(inTagen(10))).toBeGreaterThanOrEqual(9);
  });
});

describe("fahrzeugHinweise – fail-closed bei fehlenden Fristen", () => {
  it("löst keinen Fristen-Alarm aus, wenn alle Daten weit in der Zukunft liegen", () => {
    const hinweise = fahrzeugHinweise([basisFahrzeug()]);
    expect(hinweise).toHaveLength(0);
  });

  it("löst kritische Alarme aus, wenn alle Datumsfelder leer sind", () => {
    const hinweise = fahrzeugHinweise([
      {
        ...basisFahrzeug(),
        tuevBis: "",
        versicherungBis: "",
        naechsteWartung: "",
        leasingEnde: "",
      },
    ]);
    const ids = hinweise.map((x) => x.id);
    expect(ids).toContain("tuev-test-kfz");
    expect(ids).toContain("vers-test-kfz");
    expect(ids).toContain("wartung-test-kfz");
    expect(ids).toContain("leasing-test-kfz");
    expect(hinweise.every((x) => x.stufe === "kritisch")).toBe(true);
  });
});

describe("fahrerHinweise – fail-closed bei fehlenden Nachweisen", () => {
  it("löst keinen Nachweis-Alarm bei gültigen Zukunftsdaten aus", () => {
    const hinweise = fahrerHinweise([basisFahrer()]).filter((x) =>
      x.id.startsWith("nw-test-fahrer"),
    );
    expect(hinweise).toHaveLength(0);
  });

  it("löst kritische Alarme aus, wenn Nachweisdaten leer sind", () => {
    const f = basisFahrer();
    const hinweise = fahrerHinweise([
      {
        ...f,
        fuehrerschein: { gueltigBis: "" },
        pSchein: { gueltigBis: "" },
        ersteHilfe: { gueltigBis: "" },
      },
    ]).filter((x) => x.id.startsWith("nw-test-fahrer"));
    expect(hinweise).toHaveLength(3);
    expect(hinweise.every((x) => x.stufe === "kritisch")).toBe(true);
  });
});
