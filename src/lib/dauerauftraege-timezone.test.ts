import { describe, expect, test } from "bun:test";

import { SEED_DAUERAUFTRAEGE, transportWritesFuer } from "@/lib/dauerauftraege";

describe("Daueraufträge erzeugen echte UTC-Zeitpunkte", () => {
  test("Sommertermin wird aus Berliner Wanduhrzeit korrekt erzeugt", () => {
    const serie = {
      ...SEED_DAUERAUFTRAEGE[0],
      generierteTermine: [],
      pausiert: false,
      endDatum: null,
    };
    const { writes } = transportWritesFuer(serie, "2026-09-16", "2026-09-16");
    expect(writes).toHaveLength(2);
    expect(writes[0]?.termin).toBe("2026-09-16T04:30:00.000Z");
    expect(writes[1]?.termin).toBe("2026-09-16T09:30:00.000Z");
  });

  test("Wintertermin berücksichtigt UTC+1", () => {
    const serie = {
      ...SEED_DAUERAUFTRAEGE[0],
      generierteTermine: [],
      pausiert: false,
      endDatum: null,
    };
    const { writes } = transportWritesFuer(serie, "2026-01-07", "2026-01-07");
    expect(writes[0]?.termin).toBe("2026-01-07T05:30:00.000Z");
    expect(writes[1]?.termin).toBe("2026-01-07T10:30:00.000Z");
  });
});
