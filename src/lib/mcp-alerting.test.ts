import { describe, expect, it } from "bun:test";
import {
  bewerteMcpAlarm,
  mcpAlarmId,
  MCP_ALARM_SCHWELLE_KRITISCH,
  MCP_ALARM_SCHWELLE_WARNUNG,
} from "./mcp-alerting";
import type { McpAufruf } from "./mcp-monitoring-shared";

const NOW = new Date("2026-08-27T12:00:00.000Z").getTime();

function auf(status: string, minutenZurueck: number, tool = "create_order"): McpAufruf {
  return {
    id: `${status}-${minutenZurueck}-${tool}`,
    zeitpunkt: new Date(NOW - minutenZurueck * 60_000).toISOString(),
    tool,
    scope: "ghasi:orders.write",
    status,
    dauerMs: 20,
    rolle: "disposition",
    clientId: null,
  };
}

describe("bewerteMcpAlarm", () => {
  it("meldet nichts bei Einzelfällen", () => {
    const a = bewerteMcpAlarm([auf("fehler", 5), auf("abgelehnt", 10)], NOW);
    expect(a.stufe).toBe("normal");
    expect(a.text).toBe("");
  });

  it("warnt bei gehäuften Abweisungen", () => {
    const aufrufe = Array.from({ length: MCP_ALARM_SCHWELLE_WARNUNG }, (_, i) =>
      auf("abgelehnt", i + 1),
    );
    const a = bewerteMcpAlarm(aufrufe, NOW);
    expect(a.stufe).toBe("warnung");
    expect(a.abgelehnt).toBe(MCP_ALARM_SCHWELLE_WARNUNG);
    expect(a.text).toContain("Abweisungen");
    expect(a.tools).toEqual(["create_order"]);
  });

  it("eskaliert zu kritisch", () => {
    const aufrufe = Array.from({ length: MCP_ALARM_SCHWELLE_KRITISCH }, (_, i) =>
      auf("fehler", i + 1),
    );
    expect(bewerteMcpAlarm(aufrufe, NOW).stufe).toBe("kritisch");
  });

  it("ignoriert Einträge außerhalb des Fensters", () => {
    const aufrufe = Array.from({ length: MCP_ALARM_SCHWELLE_KRITISCH }, (_, i) =>
      auf("fehler", 120 + i),
    );
    const a = bewerteMcpAlarm(aufrufe, NOW);
    expect(a.stufe).toBe("normal");
    expect(a.fehler).toBe(0);
  });

  it("zählt Erfolge nicht mit", () => {
    const aufrufe = Array.from({ length: 20 }, (_, i) => auf("erfolg", i));
    expect(bewerteMcpAlarm(aufrufe, NOW).stufe).toBe("normal");
  });

  it("liefert eine stabile ID innerhalb desselben Fensters", () => {
    const a = bewerteMcpAlarm(
      Array.from({ length: MCP_ALARM_SCHWELLE_WARNUNG }, (_, i) => auf("fehler", i + 1)),
      NOW,
    );
    expect(mcpAlarmId(a, NOW)).toBe(mcpAlarmId(a, NOW + 60_000));
  });
});
