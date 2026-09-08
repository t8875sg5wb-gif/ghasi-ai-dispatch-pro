// Filter-Presets für das Admin-Widget „Agenten-Zugriffe (MCP)“.
// Client-sicher (keine Server-Imports), damit es auch in Tests läuft.

export type McpFilter = {
  suche: string;
  tool: string;
  rolle: string;
  scope: string;
  status: string;
  von: string;
  bis: string;
};

export const MCP_FILTER_LEER: McpFilter = {
  suche: "",
  tool: "alle",
  rolle: "alle",
  scope: "alle",
  status: "alle",
  von: "",
  bis: "",
};

export const MCP_PRESET_STORAGE_KEY = "ghasi.mcp.filter-presets.v1";

export type McpPreset = {
  id: string;
  name: string;
  filter: McpFilter;
};

/** Datum als YYYY-MM-TT in lokaler Zeit (Input type=date erwartet dieses Format). */
export function isoDatum(d: Date): string {
  const j = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${j}-${m}-${t}`;
}

function tageZurueck(basis: Date, tage: number): Date {
  const d = new Date(basis);
  d.setDate(d.getDate() - tage);
  return d;
}

/**
 * Eingebaute Presets. Zeitraum wird beim Anwenden relativ zu `jetzt` berechnet,
 * damit „letzte 24 Stunden“ nicht einfriert.
 */
export const MCP_STANDARD_PRESETS: ReadonlyArray<{
  id: string;
  name: string;
  bauen: (jetzt: Date) => McpFilter;
}> = [
  {
    id: "std-24h",
    name: "Letzte 24 Stunden",
    bauen: (jetzt) => ({
      ...MCP_FILTER_LEER,
      von: isoDatum(tageZurueck(jetzt, 1)),
      bis: isoDatum(jetzt),
    }),
  },
  {
    id: "std-7t",
    name: "Letzte 7 Tage",
    bauen: (jetzt) => ({
      ...MCP_FILTER_LEER,
      von: isoDatum(tageZurueck(jetzt, 6)),
      bis: isoDatum(jetzt),
    }),
  },
  {
    id: "std-fehler",
    name: "Nur Fehler",
    bauen: () => ({ ...MCP_FILTER_LEER, status: "fehler" }),
  },
  {
    id: "std-abgelehnt",
    name: "Nur abgelehnt",
    bauen: () => ({ ...MCP_FILTER_LEER, status: "abgelehnt" }),
  },
  {
    id: "std-fehler-24h",
    name: "Fehler letzte 24 Stunden",
    bauen: (jetzt) => ({
      ...MCP_FILTER_LEER,
      status: "fehler",
      von: isoDatum(tageZurueck(jetzt, 1)),
      bis: isoDatum(jetzt),
    }),
  },
];

/** Unbekannte Felder werden verworfen, fehlende mit Standardwerten gefüllt. */
export function normalisiereFilter(rohwert: unknown): McpFilter {
  const q = (rohwert ?? {}) as Record<string, unknown>;
  const txt = (w: unknown, fallback: string) => (typeof w === "string" ? w : fallback);
  return {
    suche: txt(q["suche"], ""),
    tool: txt(q["tool"], "alle"),
    rolle: txt(q["rolle"], "alle"),
    scope: txt(q["scope"], "alle"),
    status: txt(q["status"], "alle"),
    von: txt(q["von"], ""),
    bis: txt(q["bis"], ""),
  };
}

export function ladePresets(storage: Pick<Storage, "getItem"> | null | undefined): McpPreset[] {
  if (!storage) return [];
  try {
    const roh = storage.getItem(MCP_PRESET_STORAGE_KEY);
    if (!roh) return [];
    const liste = JSON.parse(roh) as unknown;
    if (!Array.isArray(liste)) return [];
    return liste
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => ({
        id: typeof e["id"] === "string" ? (e["id"] as string) : crypto.randomUUID(),
        name: typeof e["name"] === "string" ? (e["name"] as string) : "Ohne Namen",
        filter: normalisiereFilter(e["filter"]),
      }));
  } catch {
    return [];
  }
}

export function speicherePresets(
  storage: Pick<Storage, "setItem"> | null | undefined,
  presets: McpPreset[],
): void {
  if (!storage) return;
  try {
    storage.setItem(MCP_PRESET_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    /* Speicher voll oder gesperrt – Presets bleiben dann nur für diese Sitzung aktiv. */
  }
}

/** Fügt hinzu oder überschreibt ein Preset mit gleichem (getrimmtem) Namen. */
export function presetHinzufuegen(
  presets: McpPreset[],
  name: string,
  filter: McpFilter,
  id: string,
): McpPreset[] {
  const sauber = name.trim();
  if (sauber === "") return presets;
  const eintrag: McpPreset = { id, name: sauber, filter: normalisiereFilter(filter) };
  const index = presets.findIndex((p) => p.name.toLowerCase() === sauber.toLowerCase());
  if (index === -1) return [...presets, eintrag];
  const kopie = [...presets];
  kopie[index] = { ...eintrag, id: presets[index]!.id };
  return kopie;
}

export function presetEntfernen(presets: McpPreset[], id: string): McpPreset[] {
  return presets.filter((p) => p.id !== id);
}

export function istFilterLeer(filter: McpFilter): boolean {
  const l = MCP_FILTER_LEER;
  return (
    filter.suche === l.suche &&
    filter.tool === l.tool &&
    filter.rolle === l.rolle &&
    filter.scope === l.scope &&
    filter.status === l.status &&
    filter.von === l.von &&
    filter.bis === l.bis
  );
}
