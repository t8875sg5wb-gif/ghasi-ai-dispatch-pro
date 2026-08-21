// Reine Vorschau-Logik für KI Auto-Dispatch.
// Enthält keinerlei Seiteneffekte – Persistenz und Toast erfolgen erst nach
// ausdrücklicher Bestätigung durch den Nutzer in src/routes/tourenplanung.tsx.
import type { Fahrer } from "@/lib/fahrer";
import type { Fahrzeug } from "@/lib/fahrzeuge";
import { empfehleDisposition, type DispatchTransport } from "@/lib/dispatch";

export interface AutoDispatchVorschlag {
  transport: DispatchTransport;
  fahrer: Fahrer;
  fahrzeug: Fahrzeug | null;
  erklaerung: string;
  gesamtScore: number;
  patch: Partial<DispatchTransport>;
}

/**
 * Berechnet für alle offenen, unzugewiesenen Transporte KI-Vorschläge.
 * Die Filterlogik und der Aufruf von `empfehleDisposition` bleiben exakt
 * gleich zur bisherigen `autoDispatch`-Implementierung.
 */
export function berechneAutoDispatchVorschlaege(
  transporte: DispatchTransport[],
  fahrer: Fahrer[],
  fahrzeuge: Fahrzeug[],
): AutoDispatchVorschlag[] {
  const vorschlaege: AutoDispatchVorschlag[] = [];

  for (const t of transporte) {
    if (
      t.liveStatus === "abgeschlossen" ||
      t.liveStatus === "storniert" ||
      (t.fahrer && t.fahrzeug)
    ) {
      continue;
    }

    const empf = empfehleDisposition(t, fahrer, fahrzeuge);
    if (!empf.fahrer) continue;

    const patch: Partial<DispatchTransport> = {
      fahrerId: empf.fahrer.id,
      fahrer: empf.fahrer.name,
      fahrzeug: empf.fahrzeug?.kennzeichen ?? t.fahrzeug,
      liveStatus: t.liveStatus === "geplant" ? "fahrzeug_zugewiesen" : t.liveStatus,
    };

    vorschlaege.push({
      transport: t,
      fahrer: empf.fahrer,
      fahrzeug: empf.fahrzeug,
      erklaerung: empf.erklaerung,
      gesamtScore: empf.gesamtScore,
      patch,
    });
  }

  return vorschlaege;
}
