// Client-sichere Filterlogik für den Admin-Bericht „Dauerauftrag-Ablehnungen“.
// Erweiterte Suche (Fahrer, Kunde, Krankenhausträger, Patient, Grund, Feldpfad)
// plus Facetten nach Aktionstyp und Feldpfad.
import type { DauerauftragAblehnung } from "@/lib/recurring-rejections.functions";

export type AblehnungFilter = {
  /** Freitextsuche (mehrere Begriffe werden UND-verknüpft). */
  suche: string;
  /** Aktive Aktionstypen; leer = alle. */
  aktionen: string[];
  /** Aktive Feldpfade; leer = alle. */
  feldpfade: string[];
};

export const LEERER_FILTER: AblehnungFilter = { suche: "", aktionen: [], feldpfade: [] };

function suchtext(a: DauerauftragAblehnung): string {
  return [
    a.patient ?? "",
    a.grund,
    a.aktion,
    a.suchfelder?.fahrer ?? "",
    a.suchfelder?.kunde ?? "",
    a.suchfelder?.traeger ?? "",
    a.zielId ?? "",
    ...a.felder.flatMap((f) => [f.path, f.label, f.message]),
  ]
    .join(" ")
    .toLowerCase();
}

/** Wendet Freitextsuche und Facetten auf die Ablehnungsliste an. */
export function filtereAblehnungen(
  eintraege: DauerauftragAblehnung[],
  filter: AblehnungFilter,
): DauerauftragAblehnung[] {
  const begriffe = filter.suche
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return eintraege.filter((a) => {
    if (filter.aktionen.length > 0 && !filter.aktionen.includes(a.aktion)) return false;
    if (filter.feldpfade.length > 0 && !a.felder.some((f) => filter.feldpfade.includes(f.path)))
      return false;
    if (begriffe.length === 0) return true;
    const text = suchtext(a);
    return begriffe.every((b) => text.includes(b));
  });
}

export type Facette = { wert: string; label: string; anzahl: number };

/** Facette der Aktionstypen mit Trefferzahl (bezogen auf die Rohliste). */
export function aktionsFacetten(
  eintraege: DauerauftragAblehnung[],
  label: (aktion: string) => string,
): Facette[] {
  const zaehler = new Map<string, number>();
  for (const a of eintraege) zaehler.set(a.aktion, (zaehler.get(a.aktion) ?? 0) + 1);
  return [...zaehler.entries()]
    .map(([wert, anzahl]) => ({ wert, label: label(wert), anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl || a.label.localeCompare(b.label, "de"));
}

/** Facette der Feldpfade mit Trefferzahl, absteigend sortiert. */
export function feldpfadFacetten(eintraege: DauerauftragAblehnung[], limit = 12): Facette[] {
  const zaehler = new Map<string, { anzahl: number; label: string }>();
  for (const a of eintraege)
    for (const f of a.felder) {
      const vorher = zaehler.get(f.path);
      zaehler.set(f.path, { anzahl: (vorher?.anzahl ?? 0) + 1, label: f.label });
    }
  return [...zaehler.entries()]
    .map(([wert, info]) => ({ wert, label: info.label, anzahl: info.anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl || a.label.localeCompare(b.label, "de"))
    .slice(0, limit);
}

/** Schaltet einen Facettenwert an bzw. aus. */
export function toggleWert(werte: string[], wert: string): string[] {
  return werte.includes(wert) ? werte.filter((w) => w !== wert) : [...werte, wert];
}
