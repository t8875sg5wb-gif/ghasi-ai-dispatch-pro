// Deckungsprüfung: Ist eine konkrete Fahrt durch die verknüpfte ärztliche
// Verordnung gedeckt? Reine Funktion ohne Seiteneffekte, rein informativ —
// sie blockiert bewusst keine Auftragserstellung.
//
// Muster wie in contract-pricing.ts: nie raten. Fehlt die Verordnung, gibt es
// kein Ergebnis (null), statt eine Deckung zu unterstellen. Ein fehlender oder
// ungültiger Termin führt zu „nicht gedeckt" – niemals zu einem geratenen
// Ersatzdatum und niemals zu einer geworfenen Ausnahme.
import type { Auftrag } from "@/lib/auftraege";
import type { Verordnung } from "@/lib/verordnungen-shared";

export interface DeckungErgebnis {
  gedeckt: boolean;
  grund?: string;
  /** Bereits auf diese Verordnung gebuchte Fahrten (inkl. der geprüften). */
  verbraucht?: number;
  /** Genehmigte Anzahl laut Verordnung (nur bei Serie mit Anzahl). */
  genehmigt?: number | null;
}

export const KEINE_VERORDNUNG_HINWEIS =
  "Keine Verordnung verknüpft – Deckung kann nicht geprüft werden.";

export const KEIN_TERMIN_HINWEIS = "Bitte zuerst einen gültigen Fahrttermin eingeben.";

type AuftragRef = Pick<Auftrag, "id" | "termin" | "transportart" | "status"> & {
  verordnungId?: string | null;
};

/** Millisekunden-Zeitstempel oder null bei fehlendem/ungültigem Wert. */
export function zeitstempel(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

const BERLIN_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Betrieblicher Kalendertag (Europe/Berlin) als YYYY-MM-DD.
 * Bewusst NICHT `toISOString().slice(0,10)` – das verschiebt Termine kurz
 * nach Mitternacht deutscher Zeit auf den Vortag.
 */
export function berlinTag(ms: number): string {
  return BERLIN_FORMAT.format(new Date(ms));
}

function istKalenderdatum(v: string | null | undefined): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Prüft die Deckung eines Auftrags durch seine Verordnung.
 *
 * @param auftrag      Der zu prüfende Auftrag (mit `verordnungId`).
 * @param verordnung   Die verknüpfte Verordnung oder null/undefined.
 * @param alleAuftraege Alle bekannten Aufträge (zur Zählung der Serie).
 * @returns `null`, wenn keine Verordnung vorliegt – es wird nichts geraten.
 */
export function pruefeDeckung(
  auftrag: AuftragRef,
  verordnung: Verordnung | null | undefined,
  alleAuftraege: AuftragRef[] = [],
): DeckungErgebnis | null {
  if (!verordnung) return null;

  // 0. Identität: Der Auftrag muss genau diese Verordnung referenzieren.
  if (auftrag.verordnungId !== verordnung.id) {
    return {
      gedeckt: false,
      grund: "Der Auftrag verweist nicht auf diese Verordnung.",
    };
  }

  // 1. Termin muss vorhanden und gültig sein – kein Ersatzdatum.
  const terminMs = zeitstempel(auftrag.termin);
  if (terminMs === null) {
    return { gedeckt: false, grund: KEIN_TERMIN_HINWEIS };
  }
  const datum = berlinTag(terminMs);

  // 2. Gültigkeitszeitraum der Serie (inklusive Grenzen)
  const von = verordnung.seriengueltigVon;
  const bis = verordnung.seriengueltigBis;
  if (von && !istKalenderdatum(von)) {
    return { gedeckt: false, grund: "Ungültiges Gültigkeitsdatum (von) in der Verordnung." };
  }
  if (bis && !istKalenderdatum(bis)) {
    return { gedeckt: false, grund: "Ungültiges Gültigkeitsdatum (bis) in der Verordnung." };
  }
  if (von && bis && von > bis) {
    return { gedeckt: false, grund: "Gültigkeitszeitraum der Verordnung ist umgekehrt." };
  }
  if (von && datum < von) {
    return {
      gedeckt: false,
      grund: `Fahrtdatum liegt vor Beginn der Gültigkeit (${von}).`,
    };
  }
  if (bis && datum > bis) {
    return {
      gedeckt: false,
      grund: `Fahrtdatum liegt nach Ende der Gültigkeit (${bis}).`,
    };
  }

  // 3. Transportart exakt gleich – keine Normalisierung.
  if (auftrag.transportart !== verordnung.transportart) {
    return {
      gedeckt: false,
      grund: `Transportart weicht ab: Auftrag „${auftrag.transportart}“, Verordnung „${verordnung.transportart}“.`,
    };
  }

  // 4. Serie: genehmigte Anzahl bereits erreicht? Zählung ausschließlich über
  //    echte Zeitstempel – UUIDs sind keine Zeitreihenfolge.
  if (verordnung.istSerie && verordnung.anzahlFaelligkeiten) {
    const vorherige = alleAuftraege.filter((a) => {
      if (a.id === auftrag.id) return false; // aktueller Auftrag zählt genau einmal
      if (a.verordnungId !== verordnung.id) return false;
      if (a.status === "storniert") return false;
      const ms = zeitstempel(a.termin);
      if (ms === null) return false;
      return ms <= terminMs;
    });
    const verbraucht = vorherige.length + 1;
    if (verbraucht > verordnung.anzahlFaelligkeiten) {
      return {
        gedeckt: false,
        grund: `Genehmigte Anzahl überschritten: ${verbraucht} von ${verordnung.anzahlFaelligkeiten} Fahrten.`,
        verbraucht,
        genehmigt: verordnung.anzahlFaelligkeiten,
      };
    }
    return { gedeckt: true, verbraucht, genehmigt: verordnung.anzahlFaelligkeiten };
  }

  return { gedeckt: true, genehmigt: verordnung.anzahlFaelligkeiten ?? null };
}
