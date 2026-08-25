// Proaktive Hinweise: GHASI AI wertet die Unternehmensdaten regelbasiert aus
// und meldet von sich aus, worauf der Unternehmer achten sollte.
import { INITIAL_FAHRER, type Fahrer } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE, type Fahrzeug } from "@/lib/fahrzeuge";
import { INITIAL_AUFTRAEGE } from "@/lib/auftraege";
import {
  INITIAL_RECHNUNGEN,
  istUeberfaellig,
  tageUeberfaellig,
  type Rechnung,
} from "@/lib/finance";

export type HinweisStufe = "kritisch" | "warnung" | "info" | "positiv";

export interface Hinweis {
  id: string;
  stufe: HinweisStufe;
  bereich: string;
  to: string;
  titel: string;
  text: string;
}

const EUR = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Tage bis zum Zieldatum. Gibt `null` zurück, wenn das Datum fehlt oder
 * ungültig ist – analog zu `fristStatus` in compliance-dates.ts.
 * WICHTIG: `null` bedeutet „Prüfung erforderlich" und MUSS an jeder
 * Aufrufstelle einen Alarm auslösen (fail-closed), niemals still „kein Alarm".
 */
export function tageBis(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ziel = new Date(iso).getTime();
  if (Number.isNaN(ziel)) return null;
  return Math.round((ziel - Date.now()) / 86_400_000);
}

/** Fail-closed: fehlendes Datum (null) gilt immer als Alarm. */
function faelligIn(tage: number | null, grenze: number): boolean {
  return tage === null || tage <= grenze;
}

const FEHLT = "kein Datum hinterlegt – Prüfung erforderlich";

/** Hinweise für eine Fahrzeugliste (fehlende Fristen = kritisch). */
export function fahrzeugHinweise(fahrzeuge: readonly Fahrzeug[]): Hinweis[] {
  const h: Hinweis[] = [];
  for (const v of fahrzeuge) {
    const wartung = tageBis(v.naechsteWartung);
    if (faelligIn(wartung, 14)) {
      h.push({
        id: `wartung-${v.id}`,
        stufe: wartung === null || wartung <= 5 ? "kritisch" : "warnung",
        bereich: "Wartung",
        to: "/wartung",
        titel: `${v.kennzeichen}: Wartung ${wartung === null ? "ungeklärt" : "fällig"}`,
        text:
          wartung === null
            ? `Nächste Wartung: ${FEHLT}.`
            : `Die nächste Wartung ist in ${wartung} Tag(en) (${v.naechsteWartung}) geplant.`,
      });
    }
    const tuev = tageBis(v.tuevBis);
    if (faelligIn(tuev, 30)) {
      h.push({
        id: `tuev-${v.id}`,
        stufe: tuev === null || tuev <= 10 ? "kritisch" : "warnung",
        bereich: "Fahrzeuge",
        to: "/fahrzeuge",
        titel: `${v.kennzeichen}: TÜV ${tuev === null ? "ungeklärt" : "läuft ab"}`,
        text:
          tuev === null
            ? `TÜV-Datum: ${FEHLT}. Fahrzeug gilt bis zur Klärung als nicht nachgewiesen.`
            : `Der TÜV ist nur noch ${tuev} Tag(e) gültig (${v.tuevBis}).`,
      });
    }
    const vers = tageBis(v.versicherungBis);
    if (faelligIn(vers, 30)) {
      h.push({
        id: `vers-${v.id}`,
        stufe: vers === null || vers <= 10 ? "kritisch" : "warnung",
        bereich: "Versicherungen",
        to: "/versicherungen",
        titel: `${v.kennzeichen}: Versicherung ${vers === null ? "ungeklärt" : "läuft bald ab"}`,
        text:
          vers === null
            ? `Versicherungsende: ${FEHLT}.`
            : `Die Versicherung endet in ${vers} Tag(en) (${v.versicherungBis}).`,
      });
    }
    const leasing = tageBis(v.leasingEnde);
    if (leasing === null) {
      h.push({
        id: `leasing-${v.id}`,
        stufe: "kritisch",
        bereich: "Leasing",
        to: "/leasing",
        titel: `${v.kennzeichen}: Leasingende ungeklärt`,
        text: `Leasingende: ${FEHLT}.`,
      });
    } else if (leasing <= 60 && leasing >= 0) {
      h.push({
        id: `leasing-${v.id}`,
        stufe: "info",
        bereich: "Leasing",
        to: "/leasing",
        titel: `${v.kennzeichen}: Leasing endet`,
        text: `Der Leasingvertrag endet in ${leasing} Tag(en) (${v.leasingEnde}).`,
      });
    }
    if (v.tankstand <= 25 && v.status !== "werkstatt") {
      h.push({
        id: `tank-${v.id}`,
        stufe: v.tankstand <= 15 ? "warnung" : "info",
        bereich: "Fahrzeuge",
        to: "/fahrzeuge",
        titel: `${v.kennzeichen}: Tankstand niedrig`,
        text: `Nur noch ${v.tankstand}% Tankfüllung – ggf. Tankstopp einplanen.`,
      });
    }
  }
  return h;
}

/** Hinweise für eine Fahrerliste (fehlende Nachweisdaten = kritisch). */
export function fahrerHinweise(fahrer: readonly Fahrer[]): Hinweis[] {
  const h: Hinweis[] = [];
  for (const f of fahrer) {
    if (f.ueberstunden >= 20) {
      h.push({
        id: `ueber-${f.id}`,
        stufe: f.ueberstunden >= 35 ? "warnung" : "info",
        bereich: "Fahrer",
        to: "/fahrer",
        titel: `${f.name}: viele Überstunden`,
        text: `${f.ueberstunden} Überstunden angesammelt – Schichtplan prüfen.`,
      });
    }
    for (const [label, nw] of [
      ["Führerschein", f.fuehrerschein],
      ["P-Schein", f.pSchein],
      ["Erste-Hilfe", f.ersteHilfe],
    ] as const) {
      const d = tageBis(nw.gueltigBis);
      if (faelligIn(d, 30)) {
        h.push({
          id: `nw-${f.id}-${label}`,
          stufe: d === null || d <= 0 ? "kritisch" : d <= 10 ? "warnung" : "info",
          bereich: "Fahrer",
          to: "/fahrer",
          titel: `${f.name}: ${label} ${d === null ? "ungeklärt" : d <= 0 ? "abgelaufen" : "läuft ab"}`,
          text:
            d === null
              ? `${label}: ${FEHLT}. Einsatz erst nach Nachweis.`
              : `${label} ${d <= 0 ? `seit ${-d} Tag(en) abgelaufen` : `nur noch ${d} Tag(e) gültig`} (${nw.gueltigBis}).`,
        });
      }
    }

    // Compliance-Vollständigkeit (Schiene A): fehlende Pflichtangaben je Fahrer
    const fehlend: string[] = [];
    if (!f.pSchein?.gueltigBis) fehlend.push("P-Schein-Datum");
    if (!f.fuehrungszeugnisDatum) fehlend.push("Führungszeugnis");
    if (!f.svAusweisVorhanden) fehlend.push("SV-Ausweis");
    if (!f.steuerId) fehlend.push("Steuer-ID");
    if (fehlend.length > 0) {
      h.push({
        id: `compliance-fahrer-${f.id}`,
        stufe: "info",
        bereich: "Compliance",
        to: "/compliance",
        titel: `${f.name}: Unterlagen unvollständig`,
        text: `Fehlt: ${fehlend.join(", ")}.`,
      });
    }
  }
  return h;
}

export function generateHinweise(): Hinweis[] {
  const h: Hinweis[] = [...fahrzeugHinweise(INITIAL_FAHRZEUGE), ...fahrerHinweise(INITIAL_FAHRER)];

  // Aufträge: nicht zugewiesene und verspätete Transporte
  const jetzt = Date.now();
  for (const a of INITIAL_AUFTRAEGE) {
    const minBis = (new Date(a.termin).getTime() - jetzt) / 60000;
    const aktiv = a.status === "neu" || a.status === "disponiert" || a.status === "unterwegs";
    const unzugewiesen = aktiv && (!a.fahrer || !a.fahrzeug);

    // Nicht zugewiesen + zeitkritisch (≤ 60 Min oder überfällig)
    if (unzugewiesen && minBis <= 60) {
      const fehlt = [!a.fahrer ? "Fahrer" : null, !a.fahrzeug ? "Fahrzeug" : null]
        .filter(Boolean)
        .join(" & ");
      h.push({
        id: `unassigned-${a.id}`,
        stufe: minBis <= 15 ? "kritisch" : minBis <= 30 ? "warnung" : "warnung",
        bereich: "Aufträge",
        to: "/auftraege",
        titel: `${a.nummer}: Nicht zugewiesen`,
        text:
          minBis < 0
            ? `Termin überschritten – ${a.patient} wartet, ${fehlt} fehlt. KI-Vorschlag prüfen.`
            : `Termin in ${Math.round(minBis)} Min, ${fehlt} fehlt. GHASI AI kann einen Fahrer vorschlagen (Bestätigung nötig).`,
      });
    } else if (aktiv && !unzugewiesen && minBis <= 30) {
      // Zugewiesen, aber knapp/verspätet
      h.push({
        id: `delay-${a.id}`,
        stufe: minBis <= 0 ? "warnung" : "info",
        bereich: "Aufträge",
        to: "/auftraege",
        titel: `${a.nummer}: Auftrag könnte verspätet sein`,
        text:
          minBis < 0
            ? `Termin überschritten – ${a.patient} wartet (Fahrer: ${a.fahrer}).`
            : `Termin in ${Math.round(minBis)} Min, Status „${a.status}", Fahrer ${a.fahrer}.`,
      });
    }
  }

  // Aggregat: Leerkilometer & Gewinn
  const gewinnHeute = INITIAL_FAHRER.reduce((s, f) => s + f.gewinnHeute, 0);
  if (gewinnHeute >= 2000) {
    h.push({
      id: "gewinn-tag",
      stufe: "positiv",
      bereich: "Statistiken",
      to: "/statistiken",
      titel: "Starker Gewinntag",
      text: `Heute bereits ${EUR(gewinnHeute)} Gewinn erzielt – über dem Durchschnitt.`,
    });
  }

  const reihenfolge: Record<HinweisStufe, number> = {
    kritisch: 0,
    warnung: 1,
    info: 2,
    positiv: 3,
  };
  return h.sort((a, b) => reihenfolge[a.stufe] - reihenfolge[b.stufe]);
}
