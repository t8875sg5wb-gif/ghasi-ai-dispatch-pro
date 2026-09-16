import { describe, expect, it } from "bun:test";

import { computeMidijobBemessung2026 } from "@/lib/midijob-2026";

describe("Midijob-Bemessung 2026", () => {
  it("trifft die amtlichen DRV-Beispielwerte bei 700 Euro", () => {
    const r = computeMidijobBemessung2026(700);
    expect(r.beitragspflichtigeEinnahmeGesamt).toBe(510.28);
    expect(r.beitragspflichtigeEinnahmeArbeitnehmer).toBe(138.87);
  });

  it("trifft die amtlichen DRV-Beispielwerte bei 1.000 Euro", () => {
    const r = computeMidijobBemessung2026(1000);
    expect(r.beitragspflichtigeEinnahmeGesamt).toBe(854.06);
    expect(r.beitragspflichtigeEinnahmeArbeitnehmer).toBe(568.36);
  });

  it("läuft an der Obergrenze auf das tatsächliche Entgelt zu", () => {
    const r = computeMidijobBemessung2026(2000);
    expect(r.beitragspflichtigeEinnahmeGesamt).toBe(2000);
    expect(r.beitragspflichtigeEinnahmeArbeitnehmer).toBe(2000);
  });

  it("lehnt Werte außerhalb des Übergangsbereichs ab", () => {
    expect(() => computeMidijobBemessung2026(603)).toThrow(/außerhalb/);
    expect(() => computeMidijobBemessung2026(2000.01)).toThrow(/außerhalb/);
  });
});
