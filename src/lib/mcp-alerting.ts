// Alerting für gehäufte MCP-Fehler und Abweisungen (Status "abgelehnt").
//
// Client-safe: reine Auswertung der bereits geladenen Audit-Metadaten, damit
// Widget, Benachrichtigungen und Tests dieselbe Logik nutzen.

import type { McpAufruf } from "@/lib/mcp-monitoring-shared";

/** Beobachtungsfenster in Minuten. */
export const MCP_ALARM_FENSTER_MINUTEN = 60;

/** Ab dieser Anzahl im Fenster gilt es als gehäuft (Warnung). */
export const MCP_ALARM_SCHWELLE_WARNUNG = 3;

/** Ab dieser Anzahl im Fenster ist die Lage kritisch. */
export const MCP_ALARM_SCHWELLE_KRITISCH = 8;

export type McpAlarmStufe = "normal" | "warnung" | "kritisch";

export interface McpAlarm {
  stufe: McpAlarmStufe;
  /** Fehler im Beobachtungsfenster. */
  fehler: number;
  /** Abweisungen (Status "abgelehnt") im Beobachtungsfenster. */
  abgelehnt: number;
  fensterMinuten: number;
  /** Betroffene Werkzeuge, absteigend nach Häufigkeit. */
  tools: string[];
  /** Kurzer, deutscher Meldungstext (leer bei stufe "normal"). */
  text: string;
}

function stufeFuer(anzahl: number): McpAlarmStufe {
  if (anzahl >= MCP_ALARM_SCHWELLE_KRITISCH) return "kritisch";
  if (anzahl >= MCP_ALARM_SCHWELLE_WARNUNG) return "warnung";
  return "normal";
}

/**
 * Bewertet, ob es im letzten Zeitfenster gehäuft zu Fehlern oder Abweisungen
 * kam. Fehler und Abweisungen werden getrennt gezählt; die höhere Stufe gewinnt.
 */
export function bewerteMcpAlarm(
  aufrufe: McpAufruf[],
  now: number = Date.now(),
  fensterMinuten: number = MCP_ALARM_FENSTER_MINUTEN,
): McpAlarm {
  const grenze = now - fensterMinuten * 60_000;
  const imFenster = aufrufe.filter((a) => {
    const t = new Date(a.zeitpunkt).getTime();
    return Number.isFinite(t) && t >= grenze && t <= now;
  });

  const fehlerhafte = imFenster.filter((a) => a.status === "fehler");
  const abgewiesene = imFenster.filter((a) => a.status === "abgelehnt");
  const fehler = fehlerhafte.length;
  const abgelehnt = abgewiesene.length;

  const stufe: McpAlarmStufe =
    stufeFuer(fehler) === "kritisch" || stufeFuer(abgelehnt) === "kritisch"
      ? "kritisch"
      : stufeFuer(fehler) === "warnung" || stufeFuer(abgelehnt) === "warnung"
        ? "warnung"
        : "normal";

  const haeufigkeit = new Map<string, number>();
  for (const a of [...fehlerhafte, ...abgewiesene]) {
    haeufigkeit.set(a.tool, (haeufigkeit.get(a.tool) ?? 0) + 1);
  }
  const tools = [...haeufigkeit.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .map(([tool]) => tool);

  const teile: string[] = [];
  if (stufeFuer(fehler) !== "normal") teile.push(`${fehler} Fehler`);
  if (stufeFuer(abgelehnt) !== "normal") teile.push(`${abgelehnt} Abweisungen`);

  return {
    stufe,
    fehler,
    abgelehnt,
    fensterMinuten,
    tools,
    text:
      stufe === "normal"
        ? ""
        : `${teile.join(" und ")} bei Agenten-Zugriffen in den letzten ${fensterMinuten} Minuten` +
          (tools.length > 0 ? ` · Betroffen: ${tools.slice(0, 3).join(", ")}` : ""),
  };
}

/** Ab so vielen Fehlern/Abweisungen gilt EIN Werkzeug als auffällig (Warnung). */
export const MCP_TOOL_ALARM_SCHWELLE_WARNUNG = 2;

/** Ab so vielen Fehlern/Abweisungen ist EIN Werkzeug kritisch. */
export const MCP_TOOL_ALARM_SCHWELLE_KRITISCH = 5;

export interface McpToolAlarm {
  tool: string;
  stufe: Exclude<McpAlarmStufe, "normal">;
  fehler: number;
  abgelehnt: number;
  /** Alle Aufrufe des Werkzeugs im Fenster. */
  gesamt: number;
  /** Anteil fehlerhafter/abgewiesener Aufrufe (0–1). */
  quote: number;
  fensterMinuten: number;
}

/**
 * Bewertet je Werkzeug, ob es im Zeitfenster ungewöhnlich viele Fehler oder
 * Abweisungen hatte. Ergebnis absteigend nach Auffälligkeit sortiert.
 */
export function bewerteToolAlarme(
  aufrufe: McpAufruf[],
  now: number = Date.now(),
  fensterMinuten: number = MCP_ALARM_FENSTER_MINUTEN,
): McpToolAlarm[] {
  const grenze = now - fensterMinuten * 60_000;
  const proTool = new Map<string, { fehler: number; abgelehnt: number; gesamt: number }>();

  for (const a of aufrufe) {
    const t = new Date(a.zeitpunkt).getTime();
    if (!Number.isFinite(t) || t < grenze || t > now) continue;
    const e = proTool.get(a.tool) ?? { fehler: 0, abgelehnt: 0, gesamt: 0 };
    e.gesamt += 1;
    if (a.status === "fehler") e.fehler += 1;
    if (a.status === "abgelehnt") e.abgelehnt += 1;
    proTool.set(a.tool, e);
  }

  const ergebnis: McpToolAlarm[] = [];
  for (const [tool, e] of proTool) {
    const negativ = e.fehler + e.abgelehnt;
    if (negativ < MCP_TOOL_ALARM_SCHWELLE_WARNUNG) continue;
    ergebnis.push({
      tool,
      stufe: negativ >= MCP_TOOL_ALARM_SCHWELLE_KRITISCH ? "kritisch" : "warnung",
      fehler: e.fehler,
      abgelehnt: e.abgelehnt,
      gesamt: e.gesamt,
      quote: e.gesamt > 0 ? negativ / e.gesamt : 0,
      fensterMinuten,
    });
  }

  return ergebnis.sort(
    (a, b) =>
      b.fehler + b.abgelehnt - (a.fehler + a.abgelehnt) ||
      b.quote - a.quote ||
      a.tool.localeCompare(b.tool, "de"),
  );
}

/** Stabile Benachrichtigungs-ID pro Fenster, damit nicht bei jedem Laden gedoppelt wird. */
export function mcpAlarmId(alarm: McpAlarm, now: number = Date.now()): string {
  const fensterSlot = Math.floor(now / (alarm.fensterMinuten * 60_000));
  return `mcp-alarm-${alarm.stufe}-${fensterSlot}`;
}
