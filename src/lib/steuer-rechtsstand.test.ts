import { describe, expect, it } from "bun:test";

import { ZUZAHLUNG_KRANKENFAHRT, zuzahlungKrankenfahrt } from "@/lib/gesetzeswerte";
import {
  DEFAULT_STEUER_MODUS,
  STEUER_HINWEIS,
  computeEinkommensteuer,
  computeEinkommensteuerSplitting,
  computeSoli,
} from "@/lib/steuer";

describe("Steuer-/Zuzahlungs-Rechtsgrenzen 14.09.2026", () => {
  it("wendet 2026 weiterhin 10 Prozent mit 5/10-Euro-Grenzen an", () => {
    expect(ZUZAHLUNG_KRANKENFAHRT.prozent).toBe(10);
    expect(ZUZAHLUNG_KRANKENFAHRT.min).toBe(5);
    expect(ZUZAHLUNG_KRANKENFAHRT.max).toBe(10);
    expect(zuzahlungKrankenfahrt(100)).toBe(10);
    expect(zuzahlungKrankenfahrt(20)).toBe(5);
  });

  it("kennzeichnet § 4 Nr. 17b nicht als pauschale Krankenfahrt-Befreiung", () => {
    expect(STEUER_HINWEIS.befreit_4_17b).toContain("besonders eingerichteten Fahrzeug");
    expect(DEFAULT_STEUER_MODUS).toBe("befreit_4_17b");
  });
  it("folgt beim Einkommensteuertarif 2026 den Abrundungsregeln des § 32a", () => {
    expect(computeEinkommensteuer(12_348.99)).toBe(0);
    expect(computeEinkommensteuer(69_879)).toBe(18_213);
    expect(computeEinkommensteuer(277_826)).toBe(105_551);
    expect(computeEinkommensteuerSplitting(100_000)).toBe(2 * computeEinkommensteuer(50_000));
  });

  it("wendet Soli-Freigrenze und Milderungszone 2026 an", () => {
    expect(computeSoli(20_350)).toBe(0);
    expect(computeSoli(20_351)).toBe(0.11);
    expect(computeSoli(50_000)).toBe(2_750);
    expect(computeSoli(40_700, true)).toBe(0);
  });
});
