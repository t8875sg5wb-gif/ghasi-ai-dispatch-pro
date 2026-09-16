import { describe, expect, it } from "vitest";
import {
  MCP_FILTER_LEER,
  MCP_STANDARD_PRESETS,
  istFilterLeer,
  ladePresets,
  normalisiereFilter,
  presetEntfernen,
  presetHinzufuegen,
  speicherePresets,
} from "./mcp-filter-presets";

function fakeStorage() {
  const daten = new Map<string, string>();
  return {
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => void daten.set(k, v),
  };
}

describe("MCP-Filter-Presets", () => {
  it("baut 24-Stunden-Preset relativ zum aktuellen Datum", () => {
    const p = MCP_STANDARD_PRESETS.find((x) => x.id === "std-24h")!;
    const f = p.bauen(new Date(2026, 2, 5));
    expect(f.von).toBe("2026-03-04");
    expect(f.bis).toBe("2026-03-05");
  });

  it("setzt für „Nur Fehler“ nur den Status", () => {
    const f = MCP_STANDARD_PRESETS.find((x) => x.id === "std-fehler")!.bauen(new Date());
    expect(f.status).toBe("fehler");
    expect(f.von).toBe("");
    expect(f.tool).toBe("alle");
  });

  it("speichert und lädt eigene Presets", () => {
    const s = fakeStorage();
    const liste = presetHinzufuegen([], "Meins", { ...MCP_FILTER_LEER, tool: "create_order" }, "a");
    speicherePresets(s, liste);
    const geladen = ladePresets(s);
    expect(geladen).toHaveLength(1);
    expect(geladen[0]!.name).toBe("Meins");
    expect(geladen[0]!.filter.tool).toBe("create_order");
  });

  it("überschreibt Preset mit gleichem Namen und behält die ID", () => {
    const a = presetHinzufuegen([], "Nur Fehler", { ...MCP_FILTER_LEER, status: "fehler" }, "id-1");
    const b = presetHinzufuegen(
      a,
      "nur fehler",
      { ...MCP_FILTER_LEER, status: "abgelehnt" },
      "id-2",
    );
    expect(b).toHaveLength(1);
    expect(b[0]!.id).toBe("id-1");
    expect(b[0]!.filter.status).toBe("abgelehnt");
  });

  it("ignoriert leere Namen und entfernt per ID", () => {
    expect(presetHinzufuegen([], "   ", MCP_FILTER_LEER, "x")).toHaveLength(0);
    const liste = presetHinzufuegen([], "A", MCP_FILTER_LEER, "x");
    expect(presetEntfernen(liste, "x")).toHaveLength(0);
  });

  it("normalisiert unbekannte/kaputte Daten", () => {
    expect(normalisiereFilter({ tool: 5, extra: true })).toEqual(MCP_FILTER_LEER);
    expect(ladePresets(null)).toEqual([]);
    expect(istFilterLeer(MCP_FILTER_LEER)).toBe(true);
    expect(istFilterLeer({ ...MCP_FILTER_LEER, suche: "x" })).toBe(false);
  });
});
