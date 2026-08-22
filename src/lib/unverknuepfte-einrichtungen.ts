/**
 * Ermittelt Aufträge, bei denen die stabile Einrichtungs-Zuordnung fehlt
 * (`pickupEinrichtungId` und/oder `destinationEinrichtungId` = null).
 * Reine Leselogik ohne Seiteneffekte – dient der Übersicht „Unverknüpfte
 * Einrichtungen“ und dem späteren Backfill der IDs.
 */
export interface UnverknuepftAuftrag {
  id: string;
  nummer: string;
  patient: string;
  status: string;
  termin: string;
  abholort: string;
  zielort: string;
  pickupEinrichtungId?: string | null;
  destinationEinrichtungId?: string | null;
}

export interface UnverknuepfteEinrichtung {
  id: string;
  name: string;
}

export type UnverknuepftSeite = "abholort" | "zielort";

export interface UnverknuepftEintrag<T extends UnverknuepftAuftrag> {
  auftrag: T;
  /** Welche Seite des Transports ist ohne Einrichtungs-ID? */
  seiten: UnverknuepftSeite[];
  /**
   * Nur ein Hinweis: Einrichtungen, deren Name als Teilstring in der
   * betroffenen Freitextadresse vorkommt. KEINE verbindliche Zuordnung.
   */
  vermuteteEinrichtungIds: string[];
}

export function findeUnverknuepfteTransporte<T extends UnverknuepftAuftrag>(
  auftraege: T[],
  einrichtungen: UnverknuepfteEinrichtung[],
): UnverknuepftEintrag<T>[] {
  const out: UnverknuepftEintrag<T>[] = [];
  for (const a of auftraege) {
    const seiten: UnverknuepftSeite[] = [];
    if (!a.pickupEinrichtungId) seiten.push("abholort");
    if (!a.destinationEinrichtungId) seiten.push("zielort");
    if (seiten.length === 0) continue;

    const texte = seiten
      .map((s) => (s === "abholort" ? a.abholort : a.zielort))
      .join(" ")
      .toLowerCase();
    const vermuteteEinrichtungIds = einrichtungen
      .filter((e) => e.name.trim().length > 2 && texte.includes(e.name.trim().toLowerCase()))
      .map((e) => e.id);

    out.push({ auftrag: a, seiten, vermuteteEinrichtungIds });
  }
  return out;
}

export function filterUnverknuepft<T extends UnverknuepftAuftrag>(
  eintraege: UnverknuepftEintrag<T>[],
  filter: {
    einrichtungId?: string | null;
    status?: string | null;
    seite?: UnverknuepftSeite | null;
  },
): UnverknuepftEintrag<T>[] {
  return eintraege.filter((e) => {
    if (filter.status && e.auftrag.status !== filter.status) return false;
    if (filter.seite && !e.seiten.includes(filter.seite)) return false;
    if (filter.einrichtungId && !e.vermuteteEinrichtungIds.includes(filter.einrichtungId))
      return false;
    return true;
  });
}
