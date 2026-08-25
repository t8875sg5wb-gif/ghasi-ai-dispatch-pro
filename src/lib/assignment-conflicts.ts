// Wiederverwendung der bestehenden Dispatch-Konflikterkennung für die
// serverseitige Zuweisungsprüfung. `src/lib/dispatch.ts` ist rein funktional
// (keine Browser-/React-Laufzeitabhängigkeiten – lucide-react wird nur für
// Icon-Metadaten importiert) und daher direkt aus einem Server-Function-
// Handler importierbar. Hier wird nur gefiltert, nicht dupliziert.
import type { Auftrag } from "@/lib/auftraege";
import { dispatchAusAuftraege, erkenneKonflikte, type KonfliktTyp } from "@/lib/dispatch";
import type { Fahrer } from "@/lib/fahrer";
import type { Fahrzeug } from "@/lib/fahrzeuge";

/**
 * Konflikte, die direkt aus dieser Zuweisung folgen. „wartung" ist bewusst
 * enthalten: TÜV-/Versicherungs-/Wartungsfristen (inkl. fehlender Daten)
 * entscheiden darüber, ob das Fahrzeug überhaupt einsetzbar ist, und müssen
 * genau im Moment der Zuweisung sichtbar sein.
 */
const ZUWEISUNGS_TYPEN: ReadonlySet<KonfliktTyp> = new Set<KonfliktTyp>([
  "doppelbuchung",
  "fahrer_nicht_verfuegbar",
  "fahrzeug_nicht_verfuegbar",
  "ungeeignet",
  "wartung",
]);

/** Warnungstexte für genau einen Auftrag (leer, wenn alles sauber ist). */
export function zuweisungsWarnungenFuer(
  auftragId: string,
  auftraege: Auftrag[],
  fahrer: Fahrer[],
  fahrzeuge: Fahrzeug[],
): string[] {
  const transporte = dispatchAusAuftraege(auftraege);
  return erkenneKonflikte(transporte, fahrer, fahrzeuge)
    .filter((k) => k.transportId === auftragId && ZUWEISUNGS_TYPEN.has(k.typ))
    .map((k) => k.text);
}
