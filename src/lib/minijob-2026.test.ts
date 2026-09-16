import { describe, expect, it } from "bun:test";

import { computeMinijob2026 } from "@/lib/minijob-2026";

const basis = {
  gesetzlichKrankenversichert: true,
  rvBefreit: false,
  mindestRvBemessung175Anwenden: false,
  u1Pflichtig: true,
  u2Pflichtig: true,
  insolvenzgeldPflichtig: true,
  steuerart: "pauschal_2" as const,
  unfallversicherungProzent: null,
};

describe("Minijob-Rechenkern 2026", () => {
  it("berechnet die amtlichen Komponenten bei 603 Euro", () => {
    const r = computeMinijob2026({ ...basis, brutto: 603 });
    expect(r.innerhalbVerdienstgrenze).toBe(true);
    expect(r.arbeitgeberKv).toBe(78.39);
    expect(r.arbeitgeberRv).toBe(90.45);
    expect(r.arbeitnehmerRv).toBe(21.71);
    expect(r.u1).toBe(4.82);
    expect(r.u2).toBe(1.33);
    expect(r.insolvenzgeld).toBe(0.9);
    expect(r.pauschsteuer).toBe(12.06);
  });
  it("wendet bei 150 Euro auf Wunsch die 175-Euro-Mindest-RV-Bemessung an", () => {
    const r = computeMinijob2026({
      ...basis,
      brutto: 150,
      mindestRvBemessung175Anwenden: true,
    });
    expect(r.arbeitgeberRv).toBe(22.5);
    expect(r.arbeitnehmerRv).toBe(10.05);
  });

  it("berechnet keine KV-Pauschale bei nicht gesetzlich Krankenversicherten", () => {
    const r = computeMinijob2026({ ...basis, brutto: 603, gesetzlichKrankenversichert: false });
    expect(r.arbeitgeberKv).toBe(0);
  });

  it("markiert individuelle Steuer und fehlende Unfallversicherung als unvollständig", () => {
    const r = computeMinijob2026({ ...basis, brutto: 603, steuerart: "individuell" });
    expect(r.vollstaendig).toBe(false);
    expect(r.fehlendePunkte.join(" ")).toContain("BMF-PAP");
    expect(r.fehlendePunkte.join(" ")).toContain("Unfallversicherung");
  });

  it("erkennt eine Überschreitung der 603-Euro-Grenze", () => {
    expect(computeMinijob2026({ ...basis, brutto: 603.01 }).innerhalbVerdienstgrenze).toBe(false);
  });
});
