// Gemeinsame Typen, Filterlogik und CSV-Aufbereitung für das MCP-Audit-Monitoring.
// Client-safe: keine Server-Imports, damit Widget und Serverfunktion dieselbe Logik nutzen.

export interface McpAufruf {
  id: string;
  /** ISO-Zeitpunkt der Ausführung. */
  zeitpunkt: string;
  tool: string;
  scope: string | null;
  /** "erfolg" | "fehler" | "abgelehnt" */
  status: string;
  dauerMs: number | null;
  rolle: string | null;
  clientId: string | null;
}

export interface McpFilter {
  /** Freitextsuche über Tool, Scope, Rolle und Client. */
  suche?: string;
  tool?: string;
  rolle?: string;
  scope?: string;
  status?: string;
  /** ISO-Datum (YYYY-MM-DD), inklusiv. */
  von?: string;
  /** ISO-Datum (YYYY-MM-DD), inklusiv. */
  bis?: string;
}

export interface McpMonitoring {
  aufrufe: McpAufruf[];
  gesamt: number;
  erfolge: number;
  fehler: number;
  abgelehnt: number;
  /** Einfacher Durchschnitt der Dauer in ms (0 bei keinen Daten). */
  durchschnittMs: number;
  /** Auswahlwerte aus dem gesamten geladenen Fenster (vor Filterung). */
  tools: string[];
  rollen: string[];
  scopes: string[];
}

/** Ein ins Archiv verschobener Audit-Eintrag (identische Metadaten + Archivinfo). */
export interface McpArchivEintrag extends McpAufruf {
  /** ISO-Zeitpunkt der Archivierung. */
  archiviertAm: string;
  /** Frist (Monate), die zum Zeitpunkt der Archivierung galt. */
  fristMonate: number;
}

export interface McpArchiv {
  eintraege: McpArchivEintrag[];
  /** Gesamtzahl der archivierten Einträge (nicht nur das geladene Fenster). */
  gesamt: number;
  /** Aktuell eingestellte Aufbewahrungsdauer im aktiven Bereich (Monate). */
  fristMonate: number;
  /** ISO-Zeitpunkt des ältesten aktiven Eintrags – oder null. */
  aeltesterAktiv: string | null;
}

export const MCP_STATUS_WERTE = ["erfolg", "abgelehnt", "fehler"] as const;

export const MCP_STATUS_LABEL: Record<string, string> = {
  erfolg: "Erfolg",
  abgelehnt: "Abgelehnt",
  fehler: "Fehler",
};

/** "alle" gilt als kein Filter. */
function aktiv(wert?: string): string | undefined {
  const v = wert?.trim();
  return v && v !== "alle" ? v : undefined;
}

export function filterAufrufe(aufrufe: McpAufruf[], filter: McpFilter): McpAufruf[] {
  const suche = aktiv(filter.suche)?.toLowerCase();
  const tool = aktiv(filter.tool);
  const rolle = aktiv(filter.rolle);
  const scope = aktiv(filter.scope);
  const status = aktiv(filter.status);
  const von = aktiv(filter.von);
  const bis = aktiv(filter.bis);

  return aufrufe.filter((a) => {
    if (tool && a.tool !== tool) return false;
    if (rolle && (a.rolle ?? "") !== rolle) return false;
    if (scope && (a.scope ?? "") !== scope) return false;
    if (status && a.status !== status) return false;
    const tag = a.zeitpunkt.slice(0, 10);
    if (von && tag < von) return false;
    if (bis && tag > bis) return false;
    if (suche) {
      const heu = [a.tool, a.scope, a.rolle, a.clientId, a.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!heu.includes(suche)) return false;
    }
    return true;
  });
}

export function fasseZusammen(
  gefiltert: McpAufruf[],
  alle: McpAufruf[],
): Omit<McpMonitoring, "aufrufe"> {
  const dauern = gefiltert.map((a) => a.dauerMs ?? 0).filter((d) => d > 0);
  const einzigartig = (werte: (string | null)[]) =>
    [...new Set(werte.filter((w): w is string => !!w))].sort((a, b) => a.localeCompare(b, "de"));
  return {
    gesamt: gefiltert.length,
    erfolge: gefiltert.filter((a) => a.status === "erfolg").length,
    fehler: gefiltert.filter((a) => a.status === "fehler").length,
    abgelehnt: gefiltert.filter((a) => a.status === "abgelehnt").length,
    durchschnittMs:
      dauern.length > 0 ? Math.round(dauern.reduce((s, d) => s + d, 0) / dauern.length) : 0,
    tools: einzigartig(alle.map((a) => a.tool)),
    rollen: einzigartig(alle.map((a) => a.rolle)),
    scopes: einzigartig(alle.map((a) => a.scope)),
  };
}

const CSV_SPALTEN = ["Zeitpunkt", "Tool", "Scope", "Rolle", "Status", "Dauer (ms)", "Client"];

/** Zeilen für den CSV-Export (deutsche Spaltennamen, lokalisierter Zeitpunkt). */
export function csvZeilen(aufrufe: McpAufruf[]): Record<string, string>[] {
  return aufrufe.map((a) => ({
    Zeitpunkt: new Date(a.zeitpunkt).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "medium",
    }),
    Tool: a.tool,
    Scope: a.scope ?? "",
    Rolle: a.rolle ?? "",
    Status: MCP_STATUS_LABEL[a.status] ?? a.status,
    "Dauer (ms)": a.dauerMs === null ? "" : String(a.dauerMs),
    Client: a.clientId ?? "",
  }));
}

export const MCP_CSV_SPALTEN = CSV_SPALTEN;
