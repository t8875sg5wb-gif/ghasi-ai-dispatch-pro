// Deckungsprüfung: Ist eine konkrete Fahrt durch die verknüpfte ärztliche
// Verordnung gedeckt? Reine Funktion ohne Seiteneffekte, rein informativ —
// sie blockiert bewusst keine Auftragserstellung.
//
// Muster wie in contract-pricing.ts: nie raten. Fehlt die Verordnung, gibt es
// kein Ergebnis (null), statt eine Deckung zu unterstellen.
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

type AuftragRef = Pick<Auftrag, "id" | "termin" | "transportart" | "status"> & {
  verordnungId?: string | null;
};

function tag(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
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

  const datum = tag(auftrag.termin);

  // 1. Gültigkeitszeitraum der Serie
  if (verordnung.seriengueltigVon && datum < verordnung.seriengueltigVon) {
    return {
      gedeckt: false,
      grund: `Fahrtdatum liegt vor Beginn der Gültigkeit (${verordnung.seriengueltigVon}).`,
    };
  }
  if (verordnung.seriengueltigBis && datum > verordnung.seriengueltigBis) {
    return {
      gedeckt: false,
      grund: `Fahrtdatum liegt nach Ende der Gültigkeit (${verordnung.seriengueltigBis}).`,
    };
  }

  // 2. Transportart konsistent?
  if (auftrag.transportart !== verordnung.transportart) {
    return {
      gedeckt: false,
      grund: `Transportart weicht ab: Auftrag „${auftrag.transportart}“, Verordnung „${verordnung.transportart}“.`,
    };
  }

  // 3. Serie: genehmigte Anzahl bereits erreicht?
  if (verordnung.istSerie && verordnung.anzahlFaelligkeiten) {
    const relevante = alleAuftraege.filter(
      (a) =>
        a.verordnungId === verordnung.id &&
        a.status !== "storniert" &&
        // Nur Fahrten, die zeitlich vor oder auf dem geprüften Auftrag liegen.
        (tag(a.termin) < datum || (tag(a.termin) === datum && a.id <= auftrag.id)),
    );
    const verbraucht = relevante.some((a) => a.id === auftrag.id)
      ? relevante.length
      : relevante.length + 1;
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
