// Client-sichere Helfer für die Detailansicht einer Dauerauftrag-Ablehnung.
//
// Zwei Aufgaben:
// 1. `bereinigeEingaben` reduziert die abgelehnten Eingabewerte auf eine
//    protokollierbare Fassung OHNE sensible Inhalte (Patientenname wird auf
//    Initialen gekürzt, Notizen/Telefon/Straße werden entfernt bzw. maskiert).
// 2. `regelErklaerung` liefert die konkrete Ablehnungslogik im Klartext,
//    damit im Bericht nachvollziehbar ist, WARUM ein Feld abgewiesen wurde.
//
// Keine Serverimporte – wird sowohl beim Protokollieren (Server) als auch in
// der Admin-Oberfläche (Client) verwendet.

/** Felder, die niemals im Ablehnungsprotokoll landen dürfen. */
export const SENSIBLE_FELDER = new Set([
  "medizinischeNotiz",
  "patientennotiz",
  "notiz",
  "telefon",
  "versichertennummer",
  "unterschrift",
  "verordnung",
]);

/** Adressteile, die nur maskiert protokolliert werden. */
const ADRESS_MASKE = new Set(["street", "houseNumber", "additionalInfo"]);

const ENTFERNT = "[entfernt – sensibel]";
const MASKIERT = "[maskiert]";

/** Kürzt einen Personennamen auf Initialen (z. B. „Anna Müller“ → „A. M.“). */
export function nameZuInitialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return "";
  return teile.map((t) => `${t[0]?.toUpperCase() ?? ""}.`).join(" ");
}

function bereinigeWert(schluessel: string, wert: unknown, tiefe: number): unknown {
  if (SENSIBLE_FELDER.has(schluessel)) return ENTFERNT;
  if (schluessel === "patient" && typeof wert === "string") return nameZuInitialen(wert);
  if (ADRESS_MASKE.has(schluessel) && typeof wert === "string" && wert.trim()) return MASKIERT;
  if (Array.isArray(wert)) {
    if (tiefe > 3) return `[${wert.length} Einträge]`;
    return wert.slice(0, 30).map((v) => bereinigeWert("", v, tiefe + 1));
  }
  if (wert && typeof wert === "object") {
    if (tiefe > 3) return "[verschachtelt]";
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(wert as Record<string, unknown>))
      out[k] = bereinigeWert(k, v, tiefe + 1);
    return out;
  }
  if (typeof wert === "string" && wert.length > 300) return `${wert.slice(0, 300)}…`;
  return wert;
}

/**
 * Bereinigt die abgelehnten Rohdaten. `values`-Patches werden flach gezogen,
 * damit die Anzeige dieselben Pfade wie die Feldfehler verwendet.
 */
export function bereinigeEingaben(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const o = data as Record<string, unknown>;
  const quelle: Record<string, unknown> = { ...o };
  const values = o["values"];
  if (values && typeof values === "object" && !Array.isArray(values)) {
    delete quelle["values"];
    Object.assign(quelle, values as Record<string, unknown>);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(quelle)) out[k] = bereinigeWert(k, v, 0);
  return out;
}

/** Regelerklärungen pro Feldpfad (Klartext, ohne Technikjargon). */
const REGEL_ERKLAERUNG: Record<string, string> = {
  patient: "Ein Dauerauftrag wird nur gespeichert, wenn ein Patientenname angegeben ist.",
  patientId:
    "Die angegebene Patienten-Verknüpfung muss auf einen bestehenden Stammdatensatz zeigen.",
  insurerId: "Die Krankenkasse muss als Stammdatensatz existieren; freie IDs werden abgewiesen.",
  pickup:
    "Die Abholadresse muss mindestens Straße, PLZ oder Ort enthalten – vollständig leere Adressen werden abgewiesen.",
  destination:
    "Die Zieladresse muss mindestens Straße, PLZ oder Ort enthalten – vollständig leere Adressen werden abgewiesen.",
  terminzeit: "Die Uhrzeit der Hinfahrt muss im Format HH:mm angegeben sein.",
  rueckfahrtzeit:
    "Ist die Rückfahrt aktiviert, muss auch eine Rückfahrtzeit im Format HH:mm gesetzt sein.",
  rhythmus: "Der Rhythmus muss einer der zugelassenen Werte sein (z. B. wöchentlich).",
  wochentage:
    "Bei wöchentlichem Rhythmus muss mindestens ein Wochentag (0 = Sonntag bis 6 = Samstag) gewählt sein.",
  startDatum: "Das Startdatum muss ein gültiges Datum im Format JJJJ-MM-TT sein.",
  endDatum:
    "Das Enddatum muss ein gültiges Datum sein und darf nicht vor dem Startdatum liegen – sonst könnte die Serie keinen Termin erzeugen.",
  pauseVon: "Eine Pause ist nur mit beiden Grenzen gültig: „Pause von“ und „Pause bis“.",
  pauseBis:
    "„Pause bis“ muss gesetzt und darf nicht vor „Pause von“ liegen, damit der Pausenzeitraum eindeutig ist.",
  mobilitaet: "Die Mobilität muss einem der zugelassenen Werte des Domänenmodells entsprechen.",
  kategorie: "Die Kategorie muss einem der zugelassenen Werte entsprechen.",
  bevorzugterFahrerId: "Der bevorzugte Fahrer muss ein bestehender Fahrerdatensatz sein.",
  bevorzugtesFahrzeugId: "Das bevorzugte Fahrzeug muss ein bestehender Fahrzeugdatensatz sein.",
  id: "Die Datensatz-ID muss eine gültige UUID eines bestehenden Dauerauftrags sein.",
  values: "Eine Änderung muss mindestens ein zu änderndes Feld enthalten.",
  formular: "Die Anfrage entsprach nicht dem erwarteten Aufbau eines Dauerauftrags.",
};

/** Klartext-Erklärung zur Ablehnungslogik eines Feldpfads. */
export function regelErklaerung(path: string): string {
  const basis = path.split(".")[0] ?? path;
  return (
    REGEL_ERKLAERUNG[path] ??
    REGEL_ERKLAERUNG[basis] ??
    "Der Wert entsprach nicht dem hinterlegten Schema (Typ, Format, erlaubte Werte oder Länge)."
  );
}
