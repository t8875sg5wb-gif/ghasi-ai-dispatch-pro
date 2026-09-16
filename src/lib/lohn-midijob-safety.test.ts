import { describe, expect, it } from "bun:test";

import { computeLohn } from "@/lib/lohn";

describe("Lohn-Rechner – ungültige Midijob-Stammdaten", () => {
  it("crasht bei 603 Euro nicht und rechnet nichts aus", () => {
    const r = computeLohn("midijob", 603);
    expect(r.rechenstatus).toBe("pruefung_erforderlich");
    expect(r.netto).toBe(0);
    expect(r.agGesamt).toBe(0);
    expect(r.anSozialversicherung).toBe(0);
    expect(r.warnung).toMatch(/Keine Beträge berechnet/);
  });

  it("crasht oberhalb 2.000 Euro nicht", () => {
    const r = computeLohn("midijob", 2000.01);
    expect(r.rechenstatus).toBe("pruefung_erforderlich");
    expect(r.agGesamt).toBe(0);
  });

  it("berechnet einen gültigen Midijob weiter", () => {
    const r = computeLohn("midijob", 1000);
    expect(r.rechenstatus).toBe("ok");
    expect(r.agGesamt).toBeGreaterThan(1000);
  });
});
