import { describe, expect, it } from "bun:test";

import {
  ablehnungsBenachrichtigungen,
  bewerteAblehnungen,
} from "@/lib/recurring-rejection-analytics";
import type { DauerauftragAblehnung } from "@/lib/recurring-rejections.functions";

const NOW = new Date("2026-08-27T12:00:00.000Z").getTime();

function ablehnung(p: Partial<DauerauftragAblehnung> = {}): DauerauftragAblehnung {
  return {
    id: p.id ?? "r1",
    zeitpunkt: p.zeitpunkt ?? new Date(NOW - 30 * 60_000).toISOString(),
    aktion: p.aktion ?? "create",
    zielId: p.zielId ?? null,
    patient: p.patient ?? "Erika Mustermann",
    grund: p.grund ?? "Ungültige Serienregel",
    felder: p.felder ?? [{ path: "wochentage", label: "Wochentage", message: "Pflichtfeld" }],
  };
}

describe("ablehnungsBenachrichtigungen", () => {
  it("erzeugt je frischer Ablehnung eine Benachrichtigung mit Zeitpunkt und Grund", () => {
    const [n] = ablehnungsBenachrichtigungen([ablehnung()], NOW);
    expect(n?.id).toBe("dauerauftrag-ablehnung:r1");
    expect(n?.titel).toContain("Neuanlage");
    expect(n?.text).toContain("Ungültige Serienregel");
    expect(n?.to).toBe("/dauerauftrag-ablehnungen");
  });

  it("ignoriert Ablehnungen außerhalb des Fensters", () => {
    const alt = ablehnung({ zeitpunkt: new Date(NOW - 40 * 60 * 60_000).toISOString() });
    expect(ablehnungsBenachrichtigungen([alt], NOW)).toHaveLength(0);
  });
});

describe("bewerteAblehnungen", () => {
  it("berechnet Erfolgsquote, Top-Gründe und Korrekturdauer", () => {
    const daten = [
      ablehnung({ id: "a", zielId: "z1", zeitpunkt: new Date(NOW - 60 * 60_000).toISOString() }),
      ablehnung({ id: "b", zielId: "z1", zeitpunkt: new Date(NOW - 50 * 60_000).toISOString() }),
      ablehnung({ id: "c", grund: "Pflichtfeld fehlt", zielId: "z2" }),
    ];
    const k = bewerteAblehnungen(daten, 9);
    expect(k.abgelehnt).toBe(3);
    expect(k.versuche).toBe(12);
    expect(k.erfolgsquote).toBeCloseTo(0.75, 5);
    expect(k.topGruende[0]).toEqual({ grund: "Ungültige Serienregel", anzahl: 2 });
    expect(k.topPfade[0]?.path).toBe("wochentage");
    expect(k.avgKorrekturMinuten).toBe(10);
  });

  it("liefert null-Werte ohne Daten", () => {
    const k = bewerteAblehnungen([], 0);
    expect(k.erfolgsquote).toBeNull();
    expect(k.avgKorrekturMinuten).toBeNull();
  });
});
