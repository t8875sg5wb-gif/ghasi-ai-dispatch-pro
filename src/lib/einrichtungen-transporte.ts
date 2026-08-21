/**
 * Zuordnung von Transporten zu einer Einrichtung (Krankenhaus, Dialysezentrum,
 * Pflegeheim). Primär über die stabilen IDs `pickupEinrichtungId` /
 * `destinationEinrichtungId`; nur wenn beide fehlen, greift der historische
 * Teilstring-Vergleich der Freitextadressen.
 */
export interface EinrichtungTransport {
  pickupEinrichtungId?: string | null;
  destinationEinrichtungId?: string | null;
  abholort: string;
  zielort: string;
}

export function transporteFuerEinrichtung<T extends EinrichtungTransport>(
  einrichtungId: string,
  name: string,
  auftraege: T[],
): T[] {
  const n = name.toLowerCase();
  return auftraege.filter((a) => {
    if (a.pickupEinrichtungId || a.destinationEinrichtungId) {
      return (
        a.pickupEinrichtungId === einrichtungId || a.destinationEinrichtungId === einrichtungId
      );
    }
    // RESTRISIKO: Dieser Teilstring-Fallback gilt für alle Aufträge ohne
    // gesetzte Einrichtungs-ID (insbesondere historische Daten) und kann
    // fremde Transporte einer Einrichtung zuordnen. Er soll durch eine
    // spätere Datenmigration/Backfill der IDs weiter reduziert werden — das
    // ist bewusst nicht Teil dieses Checkpoints.
    return a.abholort.toLowerCase().includes(n) || a.zielort.toLowerCase().includes(n);
  });
}
