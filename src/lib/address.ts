// Strukturierte Adressen für das gesamte GHASI-AI-System.
//
// Backward-Kompatibilität: Bestehende Daten speichern Adressen als einzelnen
// String (z. B. "Lindenstraße 12, 10969 Berlin"). `parseAdresse` zerlegt einen
// solchen String bestmöglich in strukturierte Felder, `formatAdresse` setzt die
// Felder wieder zu einem String zusammen. So können Module, die weiterhin einen
// String erwarten (DB-Spalten, Karten, KI), unverändert weiterlaufen, während
// Formulare die Adresse strukturiert anzeigen und bearbeiten.

export interface AdresseStruktur {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  additionalInfo: string;
}

export const LAND_STANDARD = "Deutschland";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

export function leereAdresse(): AdresseStruktur {
  return {
    street: "",
    houseNumber: "",
    postalCode: "",
    city: "",
    country: LAND_STANDARD,
    additionalInfo: "",
  };
}

/** Hat die Adresse mindestens ein gefülltes Kernfeld? */
export function adresseGefuellt(a: AdresseStruktur): boolean {
  return Boolean(a.street.trim() || a.houseNumber.trim() || a.postalCode.trim() || a.city.trim());
}

/** Robustly coerces partially migrated/nullable address objects into the app shape. */
export function normalisiereAdresse(
  input: Partial<AdresseStruktur> | string | null | undefined,
): AdresseStruktur {
  if (typeof input === "string" || input == null) return parseAdresse(input);
  return {
    street: text(input.street),
    houseNumber: text(input.houseNumber),
    postalCode: text(input.postalCode),
    city: text(input.city),
    country: text(input.country, LAND_STANDARD) || LAND_STANDARD,
    additionalInfo: text(input.additionalInfo),
  };
}

/** Prefer structured fields; fall back to a legacy one-line address string. */
export function adresseAusStrukturOderLegacy(
  struktur: Partial<AdresseStruktur> | null | undefined,
  legacy: string | null | undefined,
): AdresseStruktur {
  const normalisiert = normalisiereAdresse(struktur);
  return adresseGefuellt(normalisiert) || normalisiert.additionalInfo.trim()
    ? normalisiert
    : parseAdresse(legacy);
}

/**
 * Zerlegt einen freien Adress-String bestmöglich in strukturierte Felder.
 * Erkennt deutsche Adressmuster wie:
 *   "Lindenstraße 12, 10969 Berlin"
 *   "Pflegeheim Sonnenhof, Berlin"
 *   "Sonnenallee 88, 12045 Berlin, Deutschland"
 * Nicht eindeutige Teile landen in `additionalInfo` bzw. `street`, damit nie
 * Information verloren geht.
 */
export function parseAdresse(input: string | null | undefined): AdresseStruktur {
  const result = leereAdresse();
  const raw = (input ?? "").trim();
  if (!raw) return result;

  // Komma-getrennte Segmente
  const segmente = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (segmente.length === 0) return result;

  // Land erkennen (letztes Segment)
  const laender = ["deutschland", "germany", "österreich", "schweiz"];
  const rest = [...segmente];
  const letztes = rest[rest.length - 1]?.toLowerCase() ?? "";
  if (laender.includes(letztes)) {
    result.country = rest.pop() as string;
  }

  // PLZ + Stadt erkennen (Segment mit führender 4–5-stelliger Zahl)
  const plzIndex = rest.findIndex((s) => /^\d{4,5}\s+\S/.test(s));
  if (plzIndex >= 0) {
    const m = rest[plzIndex].match(/^(\d{4,5})\s+(.+)$/);
    if (m) {
      result.postalCode = m[1];
      result.city = m[2].trim();
    }
    rest.splice(plzIndex, 1);
  }

  // Straße + Hausnummer aus erstem Segment, das wie eine Straße aussieht
  const strIndex = rest.findIndex((s) => /\d/.test(s) && /[a-zäöüß]/i.test(s));
  if (strIndex >= 0) {
    const seg = rest[strIndex];
    const m = seg.match(/^(.*?)[\s]+(\d+\s*[a-zA-Z]?(?:\s*-\s*\d+)?)$/);
    if (m) {
      result.street = m[1].trim();
      result.houseNumber = m[2].replace(/\s+/g, "");
    } else {
      result.street = seg;
    }
    rest.splice(strIndex, 1);
  } else if (rest.length > 0 && !result.street) {
    // Kein klares Straßenmuster: erstes Segment als Straße/Name übernehmen
    result.street = rest.shift() as string;
  }

  // Falls noch keine Stadt gesetzt, letztes verbliebenes Segment als Stadt
  if (!result.city && rest.length > 0) {
    result.city = rest.pop() as string;
  }

  // Reste als Zusatzinfo bewahren
  if (rest.length > 0) {
    result.additionalInfo = [result.additionalInfo, ...rest].filter(Boolean).join(", ");
  }

  return result;
}

/** Setzt strukturierte Felder zu einem einzeiligen Adress-String zusammen. */
export function formatAdresse(a: AdresseStruktur): string {
  const adr = normalisiereAdresse(a);
  const strasse = [adr.street, adr.houseNumber]
    .filter((s) => s && s.trim())
    .join(" ")
    .trim();
  const ort = [adr.postalCode, adr.city]
    .filter((s) => s && s.trim())
    .join(" ")
    .trim();
  const teile = [strasse, ort].filter(Boolean);
  if (adr.country && adr.country.trim() && adr.country.trim() !== LAND_STANDARD) {
    teile.push(adr.country.trim());
  }
  let out = teile.join(", ");
  if (adr.additionalInfo && adr.additionalInfo.trim()) {
    out = out ? `${out} (${adr.additionalInfo.trim()})` : adr.additionalInfo.trim();
  }
  return out;
}

/** Mehrzeilige Darstellung für Detailansichten. */
export function formatAdresseMehrzeilig(a: AdresseStruktur): string[] {
  const adr = normalisiereAdresse(a);
  const zeilen: string[] = [];
  const strasse = [adr.street, adr.houseNumber]
    .filter((s) => s && s.trim())
    .join(" ")
    .trim();
  if (strasse) zeilen.push(strasse);
  const ort = [adr.postalCode, adr.city]
    .filter((s) => s && s.trim())
    .join(" ")
    .trim();
  if (ort) zeilen.push(ort);
  if (adr.country && adr.country.trim() && adr.country.trim() !== LAND_STANDARD) {
    zeilen.push(adr.country.trim());
  }
  if (adr.additionalInfo && adr.additionalInfo.trim()) zeilen.push(adr.additionalInfo.trim());
  return zeilen;
}

/** Kurze Stadt-/Ort-Kennung für Distanz-/Nähe-Heuristiken. */
export function adresseStadt(input: string | AdresseStruktur | null | undefined): string {
  const a = typeof input === "string" ? parseAdresse(input) : (input ?? leereAdresse());
  return (a.city || "").trim().toLowerCase();
}
