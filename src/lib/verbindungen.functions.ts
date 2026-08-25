// Statusabfrage für externe Verbindungen. Gibt bewusst nur Booleans und einen
// Prüfzeitpunkt zurück – niemals Keys oder Teile davon.
import { createServerFn } from "@tanstack/react-start";

/** Ergebnis eines Health-Checks für eine einzelne Verbindung. */
export interface VerbindungHealth {
  /** Stabile Kennung, passend zum UI-Eintrag. */
  id: string;
  konfiguriert: boolean;
}

export interface VerbindungsHealth {
  /** ISO-Zeitstempel des Checks (Serverzeit). */
  geprueftAm: string;
  dienste: VerbindungHealth[];
}

export const getWebZugriffStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { istWebZugriffKonfiguriert } = await import("@/lib/web-search.server");
  return { konfiguriert: istWebZugriffKonfiguriert() };
});

export const getVerbindungsHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<VerbindungsHealth> => {
    const { istKeyGesetzt } = await import("@/lib/web-search.server");
    return {
      geprueftAm: new Date().toISOString(),
      dienste: [
        { id: "web-zugriff", konfiguriert: istKeyGesetzt(process.env.FIRECRAWL_API_KEY) },
        { id: "karten", konfiguriert: istKeyGesetzt(process.env.GOOGLE_MAPS_API_KEY) },
        { id: "ki-dienst", konfiguriert: istKeyGesetzt(process.env.LOVABLE_API_KEY) },
        { id: "datenbank", konfiguriert: istKeyGesetzt(process.env.SUPABASE_URL) },
      ],
    };
  },
);
