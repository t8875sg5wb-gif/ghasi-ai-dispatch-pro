/**
 * Auto-Save-Entwürfe für das Dauerauftrags-Formular.
 *
 * Bewusste Entscheidungen:
 * - Speicherung ausschließlich clientseitig in `sessionStorage`. Entwürfe enthalten
 *   Patientendaten (Name, medizinische Notiz); sie sollen deshalb nicht dauerhaft
 *   auf dem Gerät liegen bleiben, sondern mit dem Schließen des Tabs verschwinden.
 * - Kein serverseitiges Speichern: unvollständige Entwürfe würden die strikte
 *   Server-Validierung verletzen und als Ablehnung protokolliert werden.
 * - Entwürfe sind reine Wiederherstellungshilfe. Die Live-Validierung arbeitet
 *   unverändert auf dem Formularzustand, nicht auf dem Entwurf.
 */

import type { Dauerauftrag } from "@/lib/dauerauftraege";

const PRAEFIX = "ghasi:dauerauftrag-entwurf:";

/** Entwürfe älter als 12 Stunden werden verworfen. */
export const ENTWURF_MAX_ALTER_MS = 12 * 60 * 60 * 1000;

/** Pause nach dem letzten Tastendruck, bevor gespeichert wird. */
export const ENTWURF_DEBOUNCE_MS = 900;

export interface GespeicherterEntwurf {
  gespeichertAm: string;
  werte: Dauerauftrag;
}

/** Stabiler Schlüssel: pro bearbeiteter Serie bzw. einer für Neuanlagen. */
export function entwurfSchluessel(id: string | null): string {
  return `${PRAEFIX}${id ?? "neu"}`;
}

type Speicher = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function speicher(): Speicher | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function speichereEntwurf(
  schluessel: string,
  werte: Dauerauftrag,
  jetzt: Date = new Date(),
  store: Speicher | null = speicher(),
): GespeicherterEntwurf | null {
  if (!store) return null;
  const eintrag: GespeicherterEntwurf = { gespeichertAm: jetzt.toISOString(), werte };
  try {
    store.setItem(schluessel, JSON.stringify(eintrag));
    return eintrag;
  } catch {
    return null;
  }
}

/* ------------------------- Fehlschlag & Wiederholung ------------------------- */

/** Wartezeiten (ms) für die automatischen Wiederholungen des Auto-Save. */
export const ENTWURF_RETRY_MS = [1200, 3000, 8000] as const;

export type EntwurfFehlerGrund = "kein_speicher" | "voll" | "fehler";

/** Technische Details des Fehlschlags – für die Detailausgabe im Formular. */
export type EntwurfTechnikInfo = {
  /** Fehlerklasse bzw. `name` der Ausnahme. */
  name: string;
  /** Originale technische Fehlermeldung. */
  message: string;
  /** Aufrufkette, falls der Browser sie liefert. */
  stack?: string;
  /** Größe der Nutzlast in Bytes (JSON), soweit ermittelbar. */
  nutzlastBytes?: number;
  /** Verwendeter Speicherschlüssel. */
  schluessel: string;
};

export type EntwurfSpeicherErgebnis =
  | { ok: true; eintrag: GespeicherterEntwurf }
  | {
      ok: false;
      grund: EntwurfFehlerGrund;
      meldung: string;
      technik: EntwurfTechnikInfo;
    };

const FEHLER_MELDUNG: Record<EntwurfFehlerGrund, string> = {
  kein_speicher:
    "Dieser Browser erlaubt keinen Zwischenspeicher (z. B. privater Modus). Bitte vor dem Schließen speichern.",
  voll: "Der Zwischenspeicher des Browsers ist voll. Ältere Entwürfe wurden entfernt – neuer Versuch läuft.",
  fehler: "Der Entwurf konnte nicht zwischengespeichert werden.",
};

function istQuotaFehler(e: unknown): boolean {
  if (typeof DOMException !== "undefined" && e instanceof DOMException) {
    return e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED";
  }
  return (
    /quota/i.test(String((e as { name?: string; message?: string })?.name ?? "")) ||
    /quota/i.test(String((e as { message?: string })?.message ?? ""))
  );
}

/**
 * Speichert einen Entwurf und meldet den Fehlschlag mit Grund, damit das
 * Formular eine verständliche Meldung anzeigen und automatisch erneut
 * versuchen kann.
 */
export function versucheEntwurfZuSpeichern(
  schluessel: string,
  werte: Dauerauftrag,
  jetzt: Date = new Date(),
  store: Speicher | null = speicher(),
): EntwurfSpeicherErgebnis {
  if (!store)
    return {
      ok: false,
      grund: "kein_speicher",
      meldung: FEHLER_MELDUNG.kein_speicher,
      technik: {
        name: "SpeicherNichtVerfuegbar",
        message: "window.sessionStorage ist nicht verfügbar oder blockiert.",
        schluessel,
      },
    };
  const eintrag: GespeicherterEntwurf = { gespeichertAm: jetzt.toISOString(), werte };
  let nutzlast = "";
  try {
    nutzlast = JSON.stringify(eintrag);
    store.setItem(schluessel, nutzlast);
    return { ok: true, eintrag };
  } catch (e) {
    const grund: EntwurfFehlerGrund = istQuotaFehler(e) ? "voll" : "fehler";
    const fehler = e as { name?: string; message?: string; stack?: string } | null;
    return {
      ok: false,
      grund,
      meldung: FEHLER_MELDUNG[grund],
      technik: {
        name: fehler?.name ?? "Error",
        message: fehler?.message ?? String(e),
        ...(fehler?.stack ? { stack: fehler.stack } : {}),
        nutzlastBytes: nutzlast.length,
        schluessel,
      },
    };
  }
}

/* ----------------------------- Fehlerbericht ----------------------------- */

/** Eingaben für den kopierbaren Fehlerbericht („Details“ im Footer). */
export type EntwurfFehlerBerichtEingabe = {
  zeitpunkt: string;
  grund: EntwurfFehlerGrund;
  meldung: string;
  versuche: number;
  wiederholt: boolean;
  technik: EntwurfTechnikInfo;
  /** Kontext der Bearbeitung: neuer Datensatz oder Serien-ID. */
  datensatz: string;
  /** Browserkennung, Adresse etc. – optional, damit es serverseitig testbar bleibt. */
  umgebung?: { userAgent?: string; url?: string };
};

const GRUND_TEXT: Record<EntwurfFehlerGrund, string> = {
  kein_speicher: "Zwischenspeicher nicht verfügbar",
  voll: "Zwischenspeicher voll (Quota)",
  fehler: "Unerwarteter Speicherfehler",
};

/**
 * Erzeugt einen vollständigen, kopierbaren Fehlerbericht mit Zeitpunkt,
 * Ursache, Request-/Kontextangaben und Aufrufkette (Stack).
 */
export function entwurfFehlerBericht(e: EntwurfFehlerBerichtEingabe): string {
  const zeilen = [
    "GHASI – Fehlerbericht Auto-Save Dauerauftrag",
    `Zeitpunkt: ${e.zeitpunkt}`,
    `Ursache: ${GRUND_TEXT[e.grund]} (${e.grund})`,
    `Meldung: ${e.meldung}`,
    `Versuche: ${e.versuche}${e.wiederholt ? " (automatischer Neuversuch läuft)" : " (kein automatischer Neuversuch mehr)"}`,
    "",
    "Request-/Kontextinformationen",
    `Datensatz: ${e.datensatz}`,
    `Speicherschlüssel: ${e.technik.schluessel}`,
    `Nutzlast: ${e.technik.nutzlastBytes !== undefined ? `${e.technik.nutzlastBytes} Zeichen` : "unbekannt"}`,
    `Adresse: ${e.umgebung?.url ?? "unbekannt"}`,
    `Browser: ${e.umgebung?.userAgent ?? "unbekannt"}`,
    "",
    "Technische Details",
    `Fehlerklasse: ${e.technik.name}`,
    `Fehlertext: ${e.technik.message}`,
    "Aufrufkette:",
    e.technik.stack ?? "(keine Aufrufkette verfügbar)",
  ];
  return zeilen.join("\n");
}

/**
 * Wartezeit bis zur nächsten automatischen Wiederholung.
 * `versuch` ist 0 für den ersten Fehlschlag. Null = keine Wiederholung mehr.
 */
export function retryVerzoegerung(versuch: number, grund: EntwurfFehlerGrund): number | null {
  // Ohne verfügbaren Speicher hilft keine Wiederholung.
  if (grund === "kein_speicher") return null;
  return ENTWURF_RETRY_MS[versuch] ?? null;
}

export function verwerfeEntwurf(schluessel: string, store: Speicher | null = speicher()): void {
  try {
    store?.removeItem(schluessel);
  } catch {
    /* ignorieren */
  }
}

/** Liest einen Entwurf; defensiv gegen kaputtes JSON und abgelaufene Einträge. */
export function ladeEntwurf(
  schluessel: string,
  jetzt: Date = new Date(),
  store: Speicher | null = speicher(),
): GespeicherterEntwurf | null {
  if (!store) return null;
  let roh: string | null = null;
  try {
    roh = store.getItem(schluessel);
  } catch {
    return null;
  }
  if (!roh) return null;
  let daten: unknown;
  try {
    daten = JSON.parse(roh);
  } catch {
    verwerfeEntwurf(schluessel, store);
    return null;
  }
  if (!daten || typeof daten !== "object") {
    verwerfeEntwurf(schluessel, store);
    return null;
  }
  const kandidat = daten as Partial<GespeicherterEntwurf>;
  const zeit =
    typeof kandidat.gespeichertAm === "string" ? Date.parse(kandidat.gespeichertAm) : NaN;
  const werte = kandidat.werte;
  if (!Number.isFinite(zeit) || !werte || typeof werte !== "object") {
    verwerfeEntwurf(schluessel, store);
    return null;
  }
  if (jetzt.getTime() - zeit > ENTWURF_MAX_ALTER_MS) {
    verwerfeEntwurf(schluessel, store);
    return null;
  }
  return { gespeichertAm: new Date(zeit).toISOString(), werte: werte as Dauerauftrag };
}

/** True, wenn sich der Entwurf inhaltlich vom Ausgangszustand unterscheidet. */
export function entwurfWeichtAb(entwurf: Dauerauftrag, basis: Dauerauftrag): boolean {
  return JSON.stringify(entwurf) !== JSON.stringify(basis);
}

/**
 * Felder, die im Entwurf vom Ausgangszustand abweichen. Werden nach dem
 * Wiederherstellen als "berührt" markiert, damit die Live-Validierung genau die
 * Felder anzeigt, die der Nutzer tatsächlich bearbeitet hat.
 */
export function geaenderteFelder(entwurf: Dauerauftrag, basis: Dauerauftrag): string[] {
  const keys = new Set<string>([...Object.keys(entwurf ?? {}), ...Object.keys(basis ?? {})]);
  const geaendert: string[] = [];
  for (const key of keys) {
    const a = (entwurf as unknown as Record<string, unknown>)[key];
    const b = (basis as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) geaendert.push(key);
  }
  return geaendert.sort();
}

/** "14:32" – kurze Anzeige für den Speicherzeitpunkt. */
export function formatUhrzeit(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Vollständige Zeitmarke für die Fußzeile: "heute 14:32 Uhr" bzw.
 * "09.09.2026 14:32 Uhr", wenn der Entwurf an einem anderen Tag entstand.
 */
export function formatZeitmarke(iso: string, jetzt: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const uhrzeit = `${formatUhrzeit(iso)} Uhr`;
  const gleicherTag =
    d.getFullYear() === jetzt.getFullYear() &&
    d.getMonth() === jetzt.getMonth() &&
    d.getDate() === jetzt.getDate();
  if (gleicherTag) return `heute ${uhrzeit}`;
  const datum = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  return `${datum} ${uhrzeit}`;
}
