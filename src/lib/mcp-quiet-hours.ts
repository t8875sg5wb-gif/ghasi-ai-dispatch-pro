// Stille-Zeiten (Wartungsfenster) für MCP-Alarme.
//
// Client-safe: reine Zeitfenster-Auswertung ohne Serverabhängigkeit, damit
// Einstellungsseite, Widget, Benachrichtigungen und Tests dieselbe Logik nutzen.
//
// Zwei Modi pro Fenster:
//  - "unterdruecken": kein Alarmbanner, keine Benachrichtigung. Die Aufrufe
//    selbst bleiben im Audit-Protokoll vollständig erhalten – es wird nur die
//    Warnanzeige stillgelegt.
//  - "nur_loggen": Alarm bleibt im Widget sichtbar (als "nur protokolliert"),
//    aber es wird keine Benachrichtigung ausgelöst.

export type StilleZeitModus = "unterdruecken" | "nur_loggen";

export interface StilleZeit {
  id: string;
  bezeichnung: string;
  /** Wochentage 0=Sonntag … 6=Samstag. Leere Liste = jeden Tag. */
  wochentage: number[];
  /** Startzeit "HH:MM" (lokale Zeit). */
  vonZeit: string;
  /** Endzeit "HH:MM" (lokale Zeit). Kleiner als `vonZeit` = über Mitternacht. */
  bisZeit: string;
  modus: StilleZeitModus;
  aktiv: boolean;
}

export const STILLE_ZEIT_MODUS_LABEL: Record<StilleZeitModus, string> = {
  unterdruecken: "Alarme unterdrücken",
  nur_loggen: "Nur protokollieren (keine Benachrichtigung)",
};

export const WOCHENTAG_LABEL = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const ZEIT_MUSTER = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Ist "HH:MM" eine gültige Uhrzeit? */
export function istGueltigeZeit(wert: string): boolean {
  return ZEIT_MUSTER.test(wert);
}

function zuMinuten(wert: string): number | null {
  const m = ZEIT_MUSTER.exec(wert);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Prüft ein Fenster auf Vollständigkeit; gibt deutsche Fehlermeldungen zurück. */
export function pruefeStilleZeit(z: StilleZeit): string[] {
  const fehler: string[] = [];
  if (!z.bezeichnung.trim()) fehler.push("Bitte eine Bezeichnung angeben.");
  if (!istGueltigeZeit(z.vonZeit)) fehler.push("Startzeit muss im Format HH:MM sein.");
  if (!istGueltigeZeit(z.bisZeit)) fehler.push("Endzeit muss im Format HH:MM sein.");
  if (istGueltigeZeit(z.vonZeit) && z.vonZeit === z.bisZeit)
    fehler.push("Start- und Endzeit dürfen nicht identisch sein.");
  return fehler;
}

/** Liest die Fenster aus einem beliebigen JSON-Wert (defensiv, nie werfend). */
export function parseStilleZeiten(raw: unknown): StilleZeit[] {
  let wert = raw;
  if (typeof wert === "string") {
    try {
      wert = JSON.parse(wert);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(wert)) return [];
  const ergebnis: StilleZeit[] = [];
  for (const e of wert) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const vonZeit = typeof o["vonZeit"] === "string" ? o["vonZeit"] : "";
    const bisZeit = typeof o["bisZeit"] === "string" ? o["bisZeit"] : "";
    if (!istGueltigeZeit(vonZeit) || !istGueltigeZeit(bisZeit)) continue;
    const tage = Array.isArray(o["wochentage"])
      ? [
          ...new Set(
            (o["wochentage"] as unknown[])
              .map((t) => Number(t))
              .filter((t) => Number.isInteger(t) && t >= 0 && t <= 6),
          ),
        ].sort((a, b) => a - b)
      : [];
    ergebnis.push({
      id: typeof o["id"] === "string" && o["id"] ? o["id"] : `sz-${ergebnis.length + 1}`,
      bezeichnung: typeof o["bezeichnung"] === "string" ? o["bezeichnung"] : "Wartungsfenster",
      wochentage: tage,
      vonZeit,
      bisZeit,
      modus: o["modus"] === "nur_loggen" ? "nur_loggen" : "unterdruecken",
      aktiv: o["aktiv"] !== false,
    });
  }
  return ergebnis;
}

/** Trifft ein einzelnes Fenster auf den Zeitpunkt zu? */
export function fensterTrifftZu(z: StilleZeit, at: Date): boolean {
  if (!z.aktiv) return false;
  const von = zuMinuten(z.vonZeit);
  const bis = zuMinuten(z.bisZeit);
  if (von === null || bis === null || von === bis) return false;

  const minuten = at.getHours() * 60 + at.getMinutes();
  const tag = at.getDay();
  const gestern = (tag + 6) % 7;
  const passtTag = (t: number) => z.wochentage.length === 0 || z.wochentage.includes(t);

  if (von < bis) {
    // Fenster innerhalb eines Tages.
    return passtTag(tag) && minuten >= von && minuten < bis;
  }
  // Fenster über Mitternacht: der Wochentag gilt für den Startzeitpunkt.
  if (minuten >= von) return passtTag(tag);
  if (minuten < bis) return passtTag(gestern);
  return false;
}

export type StilleZeitWirkung = "aus" | "unterdruecken" | "nur_loggen";

export interface StilleZeitStatus {
  wirkung: StilleZeitWirkung;
  /** Das greifende Fenster (bei mehreren: das strengste). */
  fenster: StilleZeit | null;
}

/**
 * Ermittelt, ob zum Zeitpunkt eine Stille-Zeit gilt. Greifen mehrere Fenster,
 * gewinnt bewusst das strengere ("unterdruecken").
 */
export function stilleZeitStatus(zeiten: StilleZeit[], at: Date = new Date()): StilleZeitStatus {
  const treffer = zeiten.filter((z) => fensterTrifftZu(z, at));
  if (treffer.length === 0) return { wirkung: "aus", fenster: null };
  const streng = treffer.find((z) => z.modus === "unterdruecken");
  if (streng) return { wirkung: "unterdruecken", fenster: streng };
  return { wirkung: "nur_loggen", fenster: treffer[0]! };
}

/** Kurzer, deutscher Anzeigetext für ein Fenster. */
export function beschreibeStilleZeit(z: StilleZeit): string {
  const tage =
    z.wochentage.length === 0 ? "täglich" : z.wochentage.map((t) => WOCHENTAG_LABEL[t]).join(", ");
  const ueberNacht = (zuMinuten(z.vonZeit) ?? 0) > (zuMinuten(z.bisZeit) ?? 0);
  return `${tage} ${z.vonZeit}–${z.bisZeit}${ueberNacht ? " (über Mitternacht)" : ""}`;
}

/** Neues, leeres Fenster mit sinnvollen Vorgaben (Nachtwartung). */
export function neueStilleZeit(): StilleZeit {
  return {
    id: `sz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    bezeichnung: "Wartungsfenster",
    wochentage: [],
    vonZeit: "02:00",
    bisZeit: "04:00",
    modus: "unterdruecken",
    aktiv: true,
  };
}
