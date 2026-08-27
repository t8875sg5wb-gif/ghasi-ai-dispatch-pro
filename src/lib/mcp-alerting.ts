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

/** Stabile Benachrichtigungs-ID pro Fenster, damit nicht bei jedem Laden gedoppelt wird. */
export function mcpAlarmId(alarm: McpAlarm, now: number = Date.now()): string {
  const fensterSlot = Math.floor(now / (alarm.fensterMinuten * 60_000));
  return `mcp-alarm-${alarm.stufe}-${fensterSlot}`;
}
