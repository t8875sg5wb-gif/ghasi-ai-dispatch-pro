// Tests für den Schwellenwert-Alarm der Ablehnungsquote.
import { describe, expect, it } from "bun:test";

import { ablehnungsquotenAlarm, bewerteAblehnungen } from "@/lib/recurring-rejection-analytics";
import type { DauerauftragAblehnung } from "@/lib/recurring-rejections.functions";

function ablehnung(i: number, grund = "Ungültige Felder"): DauerauftragAblehnung {
  return {
    id: `r-${i}`,
    zeitpunkt: new Date(2026, 8, 10, 9, i).toISOString(),
    aktion: "create",
    patient: `Patient ${i}`,
    grund,
    zielId: null,
    felder: [],
  } as unknown as DauerauftragAblehnung;
}

const OPT = {
  schwelleProzent: 25,
  minVersuche: 5,
  zeitraumLabel: "heute",
  zeitraumKey: "2026-09-10",
};

describe("ablehnungsquotenAlarm", () => {
  it("warnt, wenn die Quote den Schwellenwert überschreitet", () => {
    const k = bewerteAblehnungen(
      [1, 2, 3, 4].map((i) => ablehnung(i)),
      6,
    ); // 40 %
    const alarm = ablehnungsquotenAlarm(k, OPT);
    expect(alarm).not.toBeNull();
    expect(alarm!.titel).toContain("40 %");
    expect(alarm!.text).toContain("Schwellenwert 25 %");
    expect(alarm!.to).toBe("/dauerauftrag-ablehnungen");
  });

  it("warnt nicht, wenn die Quote den Schwellenwert nur erreicht", () => {
    const k = bewerteAblehnungen(
      [1, 2].map((i) => ablehnung(i)),
      6,
    ); // 25 %
    expect(ablehnungsquotenAlarm(k, OPT)).toBeNull();
  });

  it("warnt nicht bei zu wenigen Versuchen", () => {
    const k = bewerteAblehnungen([ablehnung(1), ablehnung(2)], 1); // 66 %, nur 3 Versuche
    expect(ablehnungsquotenAlarm(k, OPT)).toBeNull();
  });

  it("liefert eine stabile ID pro Zeitraum und Quote", () => {
    const k = bewerteAblehnungen(
      [1, 2, 3, 4].map((i) => ablehnung(i)),
      6,
    );
    const a = ablehnungsquotenAlarm(k, OPT);
    const b = ablehnungsquotenAlarm(k, OPT);
    expect(a!.id).toBe(b!.id);
    expect(a!.id).toContain("2026-09-10");
  });

  it("nennt die häufigsten Gründe", () => {
    const rows = [
      ablehnung(1, "Fehlende Wochentage"),
      ablehnung(2, "Fehlende Wochentage"),
      ablehnung(3),
    ];
    const k = bewerteAblehnungen(rows, 1); // 75 %, 4 Versuche
    const alarm = ablehnungsquotenAlarm(k, { ...OPT, minVersuche: 1 });
    expect(alarm!.text).toContain("Fehlende Wochentage (2×)");
  });
});
