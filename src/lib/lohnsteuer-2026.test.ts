import { describe, expect, it } from "bun:test";

import {
  berechneLohnsteuerPap2026,
  LOHNSTEUER_2026_INPUT_NAMES,
  lohnsteuerPap2026Schema,
  type LohnsteuerPap2026Input,
} from "@/lib/lohnsteuer-2026";

const basis: LohnsteuerPap2026Input = {
  af: 1,
  AJAHR: 0,
  ALTER1: 0,
  ALV: 0,
  f: 1,
  JFREIB: 0,
  JHINZU: 0,
  JRE4: 0,
  JRE4ENT: 0,
  JVBEZ: 0,
  KRV: 0,
  KVZ: 2.9,
  LZZ: 2,
  LZZFREIB: 0,
  LZZHINZU: 0,
  MBV: 0,
  PKPV: 0,
  PKPVAGZ: 0,
  PKV: 0,
  PVA: 0,
  PVS: 0,
  PVZ: 1,
  R: 0,
  RE4: 500000,
  SONSTB: 0,
  SONSTENT: 0,
  STERBE: 0,
  STKL: 1,
  VBEZ: 0,
  VBEZM: 0,
  VBEZS: 0,
  VBS: 0,
  VJAHR: 0,
  ZKF: 0,
  ZMVB: 0,
};

const fall = (werte: Partial<LohnsteuerPap2026Input>) => ({ ...basis, ...werte });
describe("BMF-PAP-Lohnsteuer 2026", () => {
  it("verlangt alle 35 offiziellen Eingaben explizit", () => {
    expect(LOHNSTEUER_2026_INPUT_NAMES).toHaveLength(35);
    const unvollstaendig = { ...basis } as Partial<LohnsteuerPap2026Input>;
    delete unvollstaendig.PVZ;
    expect(lohnsteuerPap2026Schema.safeParse(unvollstaendig).success).toBe(false);
  });

  it("trifft den amtlichen BMF-Referenzfall 5.000 EUR / Klasse I", () => {
    const r = berechneLohnsteuerPap2026(fall({ KVZ: 2.5 }));
    expect(r.LSTLZZ).toBe(78583);
    expect(r.SOLZLZZ).toBe(0);
  });

  const klassen = [
    [1, 78241],
    [2, 66450],
    [3, 40183],
    [4, 78241],
    [5, 128033],
    [6, 132458],
  ] as const;
  for (const [steuerklasse, erwartet] of klassen) {
    it(`trifft Klasse ${steuerklasse} bei 5.000 EUR Monatsbrutto`, () => {
      const r = berechneLohnsteuerPap2026(fall({ STKL: steuerklasse }));
      expect(r.LSTLZZ).toBe(erwartet);
      expect(r.SOLZLZZ).toBe(0);
    });
  }

  it("trifft hohe Klasse I inklusive Soli", () => {
    const r = berechneLohnsteuerPap2026(fall({ RE4: 800000, PVZ: 0 }));
    expect(r.LSTLZZ).toBe(182491);
    expect(r.SOLZLZZ).toBe(1536);
  });

  it("trifft Jahres-, Wochen- und Tageszeitraum", () => {
    expect(berechneLohnsteuerPap2026(fall({ LZZ: 1, RE4: 6000000 })).LSTLZZ).toBe(938900);
    expect(berechneLohnsteuerPap2026(fall({ LZZ: 3, RE4: 100000 })).LSTLZZ).toBe(13895);
    expect(berechneLohnsteuerPap2026(fall({ LZZ: 4, RE4: 20000 })).LSTLZZ).toBe(3581);
  });
});
