// Terminvorschau für Daueraufträge: zeigt vor dem Speichern, welche Termine
// aus Start-/Enddatum, Rhythmus, Wochentagen, Pausen, Feiertagen und
// übersprungenen Tagen tatsächlich entstehen. Rein clientseitige Ableitung –
// identische Logik wie die Transport-Erzeugung (src/lib/dauerauftraege.ts).
import { useMemo } from "react";
import { AlertTriangle, CalendarClock, PauseCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  formatDatumDe,
  heuteISO,
  isoPlusTage,
  istFeiertag,
  naechsteTermine,
  regelTrifftZu,
  transportFaelltAn,
  type Dauerauftrag,
} from "@/lib/dauerauftraege";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TERMINE = 12;
const FENSTER_TAGE = 120;

type Ausgeschlossen = { iso: string; grund: string };

/** Live gemeldeter Regelfehler (Feldpfad + Meldung) aus der Formularvalidierung. */
export type RegelFehler = { path: string; label: string; message: string };

/** Feldpfade, die die Serienregel bestimmen – nur diese blockieren die Vorschau. */
export const SERIEN_FELDER = [
  "startDatum",
  "endDatum",
  "wochentage",
  "pauseVon",
  "pauseBis",
  "rhythmus",
  "terminzeit",
  "rueckfahrtzeit",
];

function grundFuer(d: Dauerauftrag, iso: string): string | null {
  if (d.pauseVon && d.pauseBis && iso >= d.pauseVon && iso <= d.pauseBis) return "Pausenzeitraum";
  if (d.uebersprungeneTermine.includes(iso)) return "manuell übersprungen";
  if (d.feiertageUeberspringen && istFeiertag(iso)) return "Feiertag";
  return null;
}

export function TerminVorschau({
  dauerauftrag,
  regelFehler = [],
  onFehlerKlick,
}: {
  dauerauftrag: Dauerauftrag;
  regelFehler?: RegelFehler[];
  onFehlerKlick?: (path: string) => void;
}) {
  const d = dauerauftrag;
  const serienFehler = regelFehler.filter((x) =>
    SERIEN_FELDER.includes(x.path.split(".")[0] ?? x.path),
  );
  const gueltigeEingabe =
    ISO.test(d.startDatum ?? "") &&
    (!d.endDatum || ISO.test(d.endDatum)) &&
    (d.rhythmus !== "woechentlich" || d.wochentage.length > 0);

  const { termine, ausgeschlossen } = useMemo(() => {
    if (!gueltigeEingabe)
      return { termine: [] as string[], ausgeschlossen: [] as Ausgeschlossen[] };
    const treffer = naechsteTermine(d, MAX_TERMINE, d.startDatum);
    const grenze = d.endDatum ?? isoPlusTage(d.startDatum, FENSTER_TAGE);
    const bis = treffer.length > 0 ? treffer[treffer.length - 1] : grenze;
    const raus: Ausgeschlossen[] = [];
    let cursor = d.startDatum;
    let schutz = 0;
    while (cursor <= bis && schutz < 400 && raus.length < 8) {
      if (regelTrifftZu(d, cursor) && !transportFaelltAn(d, cursor)) {
        const grund = grundFuer(d, cursor);
        if (grund) raus.push({ iso: cursor, grund });
      }
      cursor = isoPlusTage(cursor, 1);
      schutz += 1;
    }
    return { termine: treffer, ausgeschlossen: raus };
  }, [d, gueltigeEingabe]);

  const fahrtenJeTermin = d.rueckfahrt ? 2 : 1;
  const heute = heuteISO();

  return (
    <section
      aria-label="Terminvorschau"
      className="rounded-lg border bg-muted/40 p-3"
      data-testid="termin-vorschau"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <CalendarClock className="size-4 text-primary" aria-hidden="true" />
          Terminvorschau
        </h3>
        {serienFehler.length === 0 && termine.length > 0 && (
          <Badge variant="secondary">
            {termine.length === MAX_TERMINE ? `erste ${MAX_TERMINE}` : `${termine.length}`} Termine
            · {termine.length * fahrtenJeTermin} Fahrten
          </Badge>
        )}
      </div>

      {serienFehler.length > 0 && (
        <ul className="space-y-1 pt-2" data-testid="termin-vorschau-fehler">
          {serienFehler.map((x) => (
            <li key={`${x.path}-${x.message}`}>
              <button
                type="button"
                onClick={() => onFehlerKlick?.(x.path)}
                className="flex w-full items-start gap-2 rounded text-left text-xs font-medium text-destructive underline-offset-2 hover:underline"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {x.label}: {x.message}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {serienFehler.length > 0 ? (
        <p className="pt-2 text-xs text-muted-foreground">
          Die Serienregel ist derzeit ungültig – die Vorschau aktualisiert sich, sobald die
          markierten Felder korrigiert sind.
        </p>
      ) : !gueltigeEingabe ? (
        <p className="pt-2 text-xs text-muted-foreground">
          Bitte Startdatum
          {d.rhythmus === "woechentlich" ? " und mindestens einen Wochentag" : ""} angeben – dann
          erscheint hier die Vorschau der erzeugten Termine.
        </p>
      ) : d.pausiert ? (
        <p className="flex items-center gap-2 pt-2 text-xs text-amber-600 dark:text-amber-500">
          <PauseCircle className="size-3.5" aria-hidden="true" />
          Serie ist pausiert – es werden aktuell keine Termine erzeugt.
        </p>
      ) : termine.length === 0 ? (
        <p className="pt-2 text-xs text-muted-foreground">
          Mit diesen Einstellungen entsteht kein Termin (Zeitraum, Pause oder Wochentage prüfen).
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5 pt-2">
          {termine.map((iso) => (
            <li key={iso}>
              <Badge variant={iso < heute ? "outline" : "default"} className="font-normal">
                {formatDatumDe(iso)} · {d.terminzeit}
                {d.rueckfahrt && d.rueckfahrtzeit ? ` / ${d.rueckfahrtzeit}` : ""}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {ausgeschlossen.length > 0 && (
        <p className="pt-2 text-xs text-muted-foreground">
          Ausgelassen:{" "}
          {ausgeschlossen.map((a) => `${formatDatumDe(a.iso)} (${a.grund})`).join(", ")}
        </p>
      )}
      {gueltigeEingabe && !d.endDatum && termine.length > 0 && (
        <p className="pt-1 text-xs text-muted-foreground">
          Kein Enddatum gesetzt – die Serie läuft unbefristet weiter.
        </p>
      )}
    </section>
  );
}
