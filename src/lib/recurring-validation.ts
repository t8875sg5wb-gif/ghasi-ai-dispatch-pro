// Shared field-level validation vocabulary for Daueraufträge (recurring orders).
// Used by the server functions (structured 400-style payload) and by the form
// (inline messages per field). Client-safe: no server imports.
import type { z } from "zod";

/** Ein konkreter Feldfehler: Pfad, sprechendes Label, verständliche Meldung. */
export type FeldFehler = {
  /** Punkt-Pfad des Feldes, z. B. "pickup.postalCode" oder "wochentage". */
  path: string;
  /** Deutsches Label des Feldes für die Anzeige. */
  label: string;
  /** Verständliche Meldung für Endnutzer. */
  message: string;
};

/** Exakte Feldnamen → deutsche Labels (Formular- und API-Anzeige). */
export const DAUERAUFTRAG_FELD_LABEL: Record<string, string> = {
  kennung: "Kennung",
  patient: "Patientenname",
  patientId: "Patient (Stammdaten)",
  insurerId: "Krankenkasse (Verknüpfung)",
  abholort: "Abholort (Freitext)",
  zielort: "Zielort (Freitext)",
  pickup: "Pickup-Adresse",
  "pickup.street": "Pickup – Straße",
  "pickup.houseNumber": "Pickup – Hausnummer",
  "pickup.postalCode": "Pickup – PLZ",
  "pickup.city": "Pickup – Ort",
  "pickup.country": "Pickup – Land",
  "pickup.additionalInfo": "Pickup – Zusatz",
  destination: "Destination-Adresse",
  "destination.street": "Destination – Straße",
  "destination.houseNumber": "Destination – Hausnummer",
  "destination.postalCode": "Destination – PLZ",
  "destination.city": "Destination – Ort",
  "destination.country": "Destination – Land",
  "destination.additionalInfo": "Destination – Zusatz",
  terminzeit: "Uhrzeit Hinfahrt",
  rueckfahrt: "Rückfahrt",
  rueckfahrtzeit: "Uhrzeit Rückfahrt",
  mobilitaet: "Mobilität",
  begleitperson: "Begleitperson",
  verordnungErforderlich: "Verordnung erforderlich",
  kostentraeger: "Abrechnungskunde",
  krankenkasse: "Krankenkasse (Text)",
  bevorzugterFahrer: "Bevorzugter Fahrer (Altbestand)",
  bevorzugtesFahrzeug: "Bevorzugtes Fahrzeug (Altbestand)",
  bevorzugterFahrerId: "Bevorzugter Fahrer",
  bevorzugtesFahrzeugId: "Bevorzugtes Fahrzeug",
  notiz: "Notiz",
  medizinischeNotiz: "Medizinische Notiz",
  kategorie: "Kategorie",
  rhythmus: "Rhythmus",
  wochentage: "Wochentage",
  startDatum: "Startdatum",
  endDatum: "Enddatum",
  pauseVon: "Pause von",
  pauseBis: "Pause bis",
  pausiert: "Pausiert",
  feiertageUeberspringen: "Feiertage überspringen",
  uebersprungeneTermine: "Übersprungene Termine",
  generierteTermine: "Generierte Termine",
  id: "Datensatz-ID",
  values: "Änderungen",
};

/** Label zu einem Pfad; fällt auf den Pfad selbst zurück. */
export function feldLabel(path: string): string {
  return (
    DAUERAUFTRAG_FELD_LABEL[path] ?? DAUERAUFTRAG_FELD_LABEL[path.replace(/^values\./, "")] ?? path
  );
}

/** Verständliche Meldung für generische Zod-Codes. */
function lesbareMeldung(issue: z.ZodIssue, label: string): string {
  switch (issue.code) {
    case "invalid_type":
      return "message" in issue && /required/i.test(String(issue.message))
        ? `${label} ist erforderlich.`
        : `${label} hat ein unerwartetes Format.`;
    case "unrecognized_keys":
      return `Unbekanntes Feld: ${(issue as unknown as { keys?: string[] }).keys?.join(", ") ?? "?"}.`;
    case "invalid_value":
    case "invalid_format":
    case "too_small":
    case "too_big":
    default:
      return issue.message || `${label} ist ungültig.`;
  }
}

/** Wandelt einen Zod-Fehler in eine flache, sortierte Feldfehler-Liste um. */
export function zuFeldFehlern(error: z.ZodError): FeldFehler[] {
  const gesehen = new Set<string>();
  const out: FeldFehler[] = [];
  for (const issue of error.issues) {
    const rohPfad = issue.path.map((p) => String(p)).join(".");
    const path = rohPfad.replace(/^values\./, "") || "formular";
    if (gesehen.has(path)) continue;
    gesehen.add(path);
    const label = feldLabel(path);
    out.push({ path, label, message: lesbareMeldung(issue, label) });
  }
  return out;
}

const MARKER = "__GHASI_FELDFEHLER__";

/**
 * Kodiert Feldfehler in eine Error-Message, damit sie den Serverfunktions-
 * Transport (nur `message` bleibt erhalten) überleben.
 */
export function kodiereFeldFehler(titel: string, fields: FeldFehler[]): string {
  const zusammenfassung = fields.map((f) => `${f.label}: ${f.message}`).join(" | ");
  return `${titel}${zusammenfassung ? ` ${zusammenfassung}` : ""}${MARKER}${JSON.stringify({ fields })}`;
}

/** Liest Feldfehler aus einer Fehlermeldung zurück (leer, wenn keine enthalten). */
export function dekodiereFeldFehler(message: string): FeldFehler[] {
  const idx = message.indexOf(MARKER);
  if (idx === -1) return [];
  try {
    const parsed = JSON.parse(message.slice(idx + MARKER.length)) as { fields?: FeldFehler[] };
    return Array.isArray(parsed.fields) ? parsed.fields : [];
  } catch {
    return [];
  }
}

/** Meldung ohne technischen Marker – für Toasts. */
export function lesbarerFehlerText(message: string): string {
  const idx = message.indexOf(MARKER);
  return (idx === -1 ? message : message.slice(0, idx)).trim();
}

/** Feldfehler als `path -> message` Map (für Formular-Anzeige). */
export function feldFehlerMap(fields: FeldFehler[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields) map[f.path] = f.message;
  return map;
}

/* ------------------------------------------------------------------ *
 * Fachliche Querregeln (identisch in Formular und Serverfunktion)
 * ------------------------------------------------------------------ */

type AdresseLike = {
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
} | null;

function adresseLeer(a: AdresseLike | undefined, legacy?: string | null): boolean {
  const text = [a?.street, a?.houseNumber, a?.postalCode, a?.city, legacy]
    .map((v) => (v ?? "").trim())
    .join("");
  return text.length === 0;
}

/** Eingaben, die für die Querregeln relevant sind (Teilmengen erlaubt). */
export type DauerauftragRegelInput = {
  patient?: string | null;
  pickup?: AdresseLike;
  destination?: AdresseLike;
  abholort?: string | null;
  zielort?: string | null;
  rhythmus?: string | null;
  wochentage?: number[] | null;
  rueckfahrt?: boolean | null;
  rueckfahrtzeit?: string | null;
  startDatum?: string | null;
  endDatum?: string | null;
  pauseVon?: string | null;
  pauseBis?: string | null;
};

/**
 * Prüft Regeln, die mehrere Felder betreffen. `vollstaendig = false` (Teil-
 * Update) überspringt Pflichtfeld-Prüfungen für nicht übergebene Felder.
 */
export function pruefeDauerauftragRegeln(
  input: DauerauftragRegelInput,
  vollstaendig = true,
): FeldFehler[] {
  const fehler: FeldFehler[] = [];
  const add = (path: string, message: string) =>
    fehler.push({ path, label: feldLabel(path), message });
  const vorhanden = (k: keyof DauerauftragRegelInput) => input[k] !== undefined;

  if (vollstaendig || vorhanden("patient")) {
    if (!(input.patient ?? "").trim()) add("patient", "Bitte den Namen des Patienten angeben.");
  }
  if (vollstaendig || vorhanden("pickup") || vorhanden("abholort")) {
    if (adresseLeer(input.pickup, input.abholort))
      add("pickup", "Bitte Straße, PLZ oder Ort der Abholadresse angeben.");
  }
  if (vollstaendig || vorhanden("destination") || vorhanden("zielort")) {
    if (adresseLeer(input.destination, input.zielort))
      add("destination", "Bitte Straße, PLZ oder Ort der Zieladresse angeben.");
  }
  if (input.rhythmus === "woechentlich" && (vollstaendig || vorhanden("wochentage"))) {
    if (!input.wochentage || input.wochentage.length === 0)
      add("wochentage", "Bei wöchentlichem Rhythmus mindestens einen Wochentag wählen.");
  }
  if (input.rueckfahrt === true && !(input.rueckfahrtzeit ?? "").trim())
    add("rueckfahrtzeit", "Bei aktivierter Rückfahrt bitte die Rückfahrtzeit angeben.");
  if (input.startDatum && input.endDatum && input.endDatum < input.startDatum)
    add("endDatum", "Das Enddatum darf nicht vor dem Startdatum liegen.");
  if (input.pauseVon && !input.pauseBis) add("pauseBis", "Bitte auch „Pause bis“ angeben.");
  if (input.pauseBis && !input.pauseVon) add("pauseVon", "Bitte auch „Pause von“ angeben.");
  if (input.pauseVon && input.pauseBis && input.pauseBis < input.pauseVon)
    add("pauseBis", "„Pause bis“ darf nicht vor „Pause von“ liegen.");

  return fehler;
}
