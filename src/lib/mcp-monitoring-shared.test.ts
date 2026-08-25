import { describe, expect, it } from "bun:test";
import {
  csvZeilen,
  fasseZusammen,
  filterAufrufe,
  MCP_CSV_SPALTEN,
  type McpAufruf,
} from "./mcp-monitoring-shared";

const aufrufe: McpAufruf[] = [
  {
    id: "1",
    zeitpunkt: "2026-08-20T10:00:00.000Z",
    tool: "list_orders",
    scope: "ghasi:orders.read",
    status: "erfolg",
    dauerMs: 100,
    rolle: "admin",
    clientId: "client-a",
  },
  {
    id: "2",
    zeitpunkt: "2026-08-22T10:00:00.000Z",
    tool: "create_order",
    scope: "ghasi:orders.write",
    status: "abgelehnt",
    dauerMs: 50,
    rolle: "disposition",
    clientId: null,
  },
  {
    id: "3",
    zeitpunkt: "2026-08-25T10:00:00.000Z",
    tool: "list_invoices",
    scope: "ghasi:invoices.read",
    status: "fehler",
    dauerMs: null,
    rolle: null,
    clientId: null,
  },
];

describe("filterAufrufe", () => {
  it("gibt ohne Filter alles zurück", () => {
    expect(filterAufrufe(aufrufe, {})).toHaveLength(3);
    expect(filterAufrufe(aufrufe, { tool: "alle", status: "alle" })).toHaveLength(3);
  });

  it("filtert nach Tool, Rolle, Scope und Status", () => {
    expect(filterAufrufe(aufrufe, { tool: "create_order" }).map((a) => a.id)).toEqual(["2"]);
    expect(filterAufrufe(aufrufe, { rolle: "admin" }).map((a) => a.id)).toEqual(["1"]);
    expect(filterAufrufe(aufrufe, { scope: "ghasi:invoices.read" }).map((a) => a.id)).toEqual([
      "3",
    ]);
    expect(filterAufrufe(aufrufe, { status: "fehler" }).map((a) => a.id)).toEqual(["3"]);
  });

  it("filtert den Zeitraum inklusiv", () => {
    expect(
      filterAufrufe(aufrufe, { von: "2026-08-22", bis: "2026-08-25" }).map((a) => a.id),
    ).toEqual(["2", "3"]);
  });

  it("sucht in Tool, Scope, Rolle und Client", () => {
    expect(filterAufrufe(aufrufe, { suche: "CLIENT-A" }).map((a) => a.id)).toEqual(["1"]);
    expect(filterAufrufe(aufrufe, { suche: "invoices" }).map((a) => a.id)).toEqual(["3"]);
  });
});

describe("fasseZusammen", () => {
  it("zählt Ergebnisse der gefilterten Menge und Auswahlwerte der Gesamtmenge", () => {
    const z = fasseZusammen(filterAufrufe(aufrufe, { status: "erfolg" }), aufrufe);
    expect(z.gesamt).toBe(1);
    expect(z.erfolge).toBe(1);
    expect(z.durchschnittMs).toBe(100);
    expect(z.tools).toEqual(["create_order", "list_invoices", "list_orders"]);
    expect(z.rollen).toEqual(["admin", "disposition"]);
    expect(z.scopes).toHaveLength(3);
  });
});

describe("csvZeilen", () => {
  it("liefert alle Exportspalten", () => {
    const zeile = csvZeilen([aufrufe[0]])[0];
    expect(Object.keys(zeile)).toEqual(MCP_CSV_SPALTEN);
    expect(zeile.Tool).toBe("list_orders");
    expect(zeile.Status).toBe("Erfolg");
    expect(zeile["Dauer (ms)"]).toBe("100");
  });
});
