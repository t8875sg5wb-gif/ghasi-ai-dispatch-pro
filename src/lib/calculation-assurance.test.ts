import { describe, expect, it } from "bun:test";

import {
  RECHEN_AGENTEN,
  RECHEN_SEITEN_AGENTEN,
  fachAgent,
  vergleicheRechenwert,
} from "@/lib/calculation-assurance";

describe("Rechen-Prüfarchitektur", () => {
  it("hat eindeutige Fach- und Seiten-Agenten", () => {
    expect(new Set(RECHEN_AGENTEN.map((a) => a.id)).size).toBe(RECHEN_AGENTEN.length);
    expect(new Set(RECHEN_SEITEN_AGENTEN.map((a) => a.id)).size).toBe(RECHEN_SEITEN_AGENTEN.length);
    expect(new Set(RECHEN_SEITEN_AGENTEN.map((a) => a.route)).size).toBe(
      RECHEN_SEITEN_AGENTEN.length,
    );
  });

  it("verweist jede Rechenseite auf einen vorhandenen Fach-Agenten", () => {
    for (const seite of RECHEN_SEITEN_AGENTEN) {
      expect(fachAgent(seite.fachAgentId)).toBeDefined();
    }
  });

  it("kennzeichnet grüne Agenten nur mit amtlicher Primärquelle", () => {
    for (const agent of RECHEN_AGENTEN.filter((a) => a.status === "gruen")) {
      expect(agent.quellen.some((q) => q.stufe === "A_AMTLICH")).toBe(true);
    }
  });
  it("hält DMRZ gesperrt und Lohnsteuer bis zum vollständigen Produkt-Mapping gelb", () => {
    expect(fachAgent("krankentransport-abrechnung")?.status).toBe("gesperrt");
    expect(fachAgent("lohnsteuer")?.status).toBe("gelb");
  });

  it("lässt eine amtliche Abweichung niemals durch Herstellermehrheit überstimmen", () => {
    const result = vergleicheRechenwert(100, [
      { quelle: "Amt", stufe: "A_AMTLICH", wert: 101 },
      { quelle: "App A", stufe: "C_BLACKBOX", wert: 100 },
      { quelle: "App B", stufe: "C_BLACKBOX", wert: 100 },
    ]);
    expect(result.status).toBe("abweichung");
    expect(result.abweichendeQuellen).toContain("Amt");
  });

  it("bestätigt amtliche plus Black-Box-Übereinstimmung", () => {
    const result = vergleicheRechenwert(100, [
      { quelle: "Amt", stufe: "A_AMTLICH", wert: 100 },
      { quelle: "App", stufe: "C_BLACKBOX", wert: 100 },
    ]);
    expect(result.status).toBe("bestaetigt");
  });
});
