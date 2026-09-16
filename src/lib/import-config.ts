// Configuration for the bulk data importer: which fields each entity accepts,
// header auto-detection aliases, and builders that turn a mapped row into the
// exact server-function write payload (with sensible defaults for everything
// the CSV/XLSX does not carry). Records are always created through the existing
// createDriver/createVehicle/createCustomer/createPatient server functions.
import type { DriverWrite } from "@/lib/drivers-shared";
import type { VehicleWrite } from "@/lib/vehicles-shared";
import type { CustomerWrite } from "@/lib/customers-shared";
import type { PatientWrite } from "@/lib/patients-shared";
import { VERTRAGSARTEN } from "@/lib/fahrer";

export type ImportEntity = "drivers" | "vehicles" | "customers" | "patients";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  /** Lowercased header aliases used for auto-detection. */
  aliases: string[];
  hint?: string;
}

export interface BuildResult {
  record: Record<string, unknown> | null;
  errors: string[];
}

export interface EntityConfig {
  label: string;
  description: string;
  fields: ImportField[];
  build: (mapped: Record<string, string>) => BuildResult;
}

/* ----------------------------- parse helpers ----------------------------- */

const trim = (v: string | undefined) => (v ?? "").trim();

function toNumber(v: string | undefined, fallback = 0): number {
  const s = trim(v)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v: string | undefined): boolean {
  const s = trim(v).toLowerCase();
  return ["ja", "yes", "true", "1", "x", "wahr"].includes(s);
}

/** Normalise a date-ish input to ISO yyyy-mm-dd; empty on failure. */
function toISODate(v: string | undefined): string {
  const s = trim(v);
  if (!s) return "";
  // dd.mm.yyyy or dd/mm/yyyy
  const de = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (de) {
    const [, d, m, y] = de;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

function matchEnum<T extends string>(v: string | undefined, options: readonly T[]): T | null {
  const s = trim(v).toLowerCase();
  return options.find((o) => o.toLowerCase() === s) ?? null;
}

/**
 * ISO-Datum oder leer, wie `isoDatumOderLeer` in `vehicles.functions.ts`.
 * Ein befuellter, aber nicht auf ein Datum abbildbarer Wert (z. B. "unbekannt")
 * wuerde sonst unveraendert als String durchgereicht und erst am Server
 * (mit verworfener Fehlermeldung, siehe datenimport.tsx) abgelehnt.
 */
function toISODateOrEmpty(v: string | undefined, label: string, errors: string[]): string {
  const raw = trim(v);
  if (!raw) return "";
  const iso = toISODate(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    errors.push(`${label} ungültig`);
    return "";
  }
  return iso;
}

/* ------------------------------ entity configs ------------------------------ */

export const ENTITY_CONFIGS: Record<ImportEntity, EntityConfig> = {
  drivers: {
    label: "Fahrer",
    description: "Personal mit Kontaktdaten, Vertrag und Nachweisfristen.",
    fields: [
      {
        key: "name",
        label: "Name",
        required: true,
        aliases: ["name", "fahrer", "vorname nachname"],
      },
      {
        key: "telefon",
        label: "Telefon",
        required: true,
        aliases: ["telefon", "tel", "handy", "mobil", "phone"],
      },
      { key: "email", label: "E-Mail", required: true, aliases: ["email", "e-mail", "mail"] },
      {
        key: "adresse",
        label: "Adresse",
        required: true,
        aliases: ["adresse", "anschrift", "address"],
      },
      {
        key: "vertragsart",
        label: "Vertragsart",
        aliases: ["vertragsart", "vertrag", "anstellung"],
        hint: "Vollzeit, Teilzeit, Minijob, Aushilfe",
      },
      { key: "arbeitszeiten", label: "Arbeitszeiten", aliases: ["arbeitszeiten", "arbeitszeit"] },
      { key: "schicht", label: "Schicht", aliases: ["schicht", "shift"] },
      {
        key: "fuehrerscheinBis",
        label: "Führerschein gültig bis",
        required: true,
        aliases: ["führerschein", "fuehrerschein", "fs bis", "führerschein bis"],
        hint: "Datum",
      },
      {
        key: "pScheinBis",
        label: "P-Schein gültig bis",
        required: true,
        aliases: ["p-schein", "pschein", "personenbeförderung"],
        hint: "Datum",
      },
      {
        key: "ersteHilfeBis",
        label: "Erste-Hilfe gültig bis",
        required: true,
        aliases: ["erste hilfe", "erste-hilfe", "ersthelfer"],
        hint: "Datum",
      },
    ],
    build: (m) => {
      // Muss mit `driverFieldsSchema` in `drivers.functions.ts` übereinstimmen
      // (telefon/email/adresse/alle drei Nachweis-Daten sind dort Pflicht,
      // ohne .optional()). Ohne diese Prüfung meldet die Vorschau eine Zeile
      // faelschlich als "gueltig", und der spaetere Server-Fehler wird beim
      // Import ohnehin verworfen (siehe datenimport.tsx) — die Zeile scheitert
      // dann unerklaert.
      const errors: string[] = [];
      const name = trim(m.name);
      if (!name) errors.push("Name fehlt");
      const telefon = trim(m.telefon);
      if (!telefon) errors.push("Telefon fehlt");
      const email = trim(m.email);
      if (!email) errors.push("E-Mail fehlt");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("E-Mail ungültig");
      const adresse = trim(m.adresse);
      if (!adresse) errors.push("Adresse fehlt");
      const fuehrerscheinBis = toISODate(m.fuehrerscheinBis);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fuehrerscheinBis))
        errors.push("Führerschein gültig bis fehlt/ungültig");
      const pScheinBis = toISODate(m.pScheinBis);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(pScheinBis))
        errors.push("P-Schein gültig bis fehlt/ungültig");
      const ersteHilfeBis = toISODate(m.ersteHilfeBis);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ersteHilfeBis))
        errors.push("Erste-Hilfe gültig bis fehlt/ungültig");
      const record: DriverWrite = {
        name,
        foto: null,
        telefon,
        email,
        adresse,
        fuehrerschein: { gueltigBis: fuehrerscheinBis },
        pSchein: { gueltigBis: pScheinBis },
        ersteHilfe: { gueltigBis: ersteHilfeBis },
        vertragsart: matchEnum(m.vertragsart, VERTRAGSARTEN) ?? "Vollzeit",
        arbeitszeiten: trim(m.arbeitszeiten),
        urlaubstage: 30,
        krankheitstage: 0,
        status: "verfuegbar",
        standort: "",
        gps: { lat: 52.29, lng: 8.9 },
        fahrzeug: null,
        schicht: trim(m.schicht),
        bewertung: 5,
        puenktlichkeit: 100,
        beschwerden: 0,
        lob: 0,
        ueberstunden: 0,
        kmHeute: 0,
        umsatzHeute: 0,
        gewinnHeute: 0,
      };
      return {
        record: errors.length ? null : (record as unknown as Record<string, unknown>),
        errors,
      };
    },
  },

  vehicles: {
    label: "Fahrzeuge",
    description: "Flotte mit Kennzeichen, Typ, Ausstattung und Fristen.",
    fields: [
      {
        key: "kennzeichen",
        label: "Kennzeichen",
        required: true,
        aliases: ["kennzeichen", "kfz", "plate"],
      },
      { key: "marke", label: "Marke", aliases: ["marke", "hersteller", "brand"] },
      { key: "modell", label: "Modell", aliases: ["modell", "model", "typbezeichnung"] },
      { key: "baujahr", label: "Baujahr", aliases: ["baujahr", "jahr", "year"], hint: "Zahl" },
      {
        key: "typ",
        label: "Typ",
        aliases: ["typ", "fahrzeugtyp", "art"],
        hint: "z. B. PKW, Rollstuhlfahrzeug, LMW",
      },
      {
        key: "sitzplaetze",
        label: "Sitzplätze",
        aliases: ["sitzplätze", "sitze", "plätze"],
        hint: "Zahl",
      },
      { key: "kraftstoff", label: "Kraftstoff", aliases: ["kraftstoff", "treibstoff", "fuel"] },
      { key: "standort", label: "Standort", aliases: ["standort", "ort", "location"] },
      {
        key: "kilometerstand",
        label: "Kilometerstand",
        aliases: ["kilometerstand", "km", "laufleistung"],
        hint: "Zahl",
      },
      {
        key: "tuevBis",
        label: "TÜV bis",
        aliases: ["tüv", "tuev", "hu", "hauptuntersuchung"],
        hint: "Datum",
      },
      {
        key: "versicherungBis",
        label: "Versicherung bis",
        aliases: ["versicherung bis", "versicherungsablauf", "kfz-versicherung bis"],
        hint: "Datum",
      },
      {
        key: "naechsteWartung",
        label: "Nächste Wartung",
        aliases: ["nächste wartung", "naechste wartung", "wartung fällig", "wartungstermin"],
        hint: "Datum",
      },
      {
        key: "leasingEnde",
        label: "Leasingende",
        aliases: ["leasingende", "leasing ende", "leasing bis"],
        hint: "Datum",
      },
      { key: "versicherung", label: "Versicherung", aliases: ["versicherung", "insurance"] },
    ],
    build: (m) => {
      // Zahlen-/Datumsgrenzen muessen mit `vehicleFieldsSchema` in
      // `vehicles.functions.ts` uebereinstimmen (baujahr 1990-2027,
      // sitzplaetze 1-20, Datumsfelder ISO-oder-leer) — sonst meldet die
      // Vorschau eine Zeile faelschlich als "gueltig".
      const errors: string[] = [];
      const kennzeichen = trim(m.kennzeichen);
      if (!kennzeichen) errors.push("Kennzeichen fehlt");
      const baujahrRaw = trim(m.baujahr);
      const baujahr = toNumber(m.baujahr, new Date().getFullYear());
      if (baujahrRaw && (baujahr < 1990 || baujahr > 2027))
        errors.push("Baujahr ungültig (1990–2027)");
      const sitzplaetzeRaw = trim(m.sitzplaetze);
      const sitzplaetze = toNumber(m.sitzplaetze, 1);
      if (sitzplaetzeRaw && (sitzplaetze < 1 || sitzplaetze > 20))
        errors.push("Sitzplätze ungültig (1–20)");
      const record: VehicleWrite = {
        kennzeichen,
        marke: trim(m.marke),
        modell: trim(m.modell),
        baujahr,
        typ: matchEnum(m.typ, ["PKW", "Rollstuhlfahrzeug", "LMW"] as const) ?? "PKW",
        rollstuhlGeeignet: false,
        liegendGeeignet: false,
        sitzplaetze,
        status: "frei",
        fahrer: null,
        standort: trim(m.standort),
        gps: { lat: 52.29, lng: 8.9 },
        kilometerstand: toNumber(m.kilometerstand),
        tankstand: 100,
        kraftstoff:
          matchEnum(m.kraftstoff, ["Diesel", "Benzin", "Elektro", "Hybrid"] as const) ?? "Diesel",
        verbrauch: 0,
        reichweite: 0,
        kostenProKm: 0,
        tagesumsatz: 0,
        tagesgewinn: 0,
        monatsumsatz: 0,
        monatsgewinn: 0,
        tuevBis: toISODateOrEmpty(m.tuevBis, "TÜV bis", errors),
        oelwechselBei: 0,
        naechsteWartung: toISODateOrEmpty(m.naechsteWartung, "Nächste Wartung", errors),
        reifenstatus: "gut",
        reparaturen: [],
        versicherung: trim(m.versicherung),
        versicherungBis: toISODateOrEmpty(m.versicherungBis, "Versicherung bis", errors),
        leasingrate: 0,
        leasingEnde: toISODateOrEmpty(m.leasingEnde, "Leasingende", errors),
        dokumente: [],
        fotos: [],
        notizen: "",
      };
      return {
        record: errors.length ? null : (record as unknown as Record<string, unknown>),
        errors,
      };
    },
  },

  customers: {
    label: "Kunden",
    description: "Auftraggeber, Kassen und Vertragspartner.",
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "kunde", "firma"] },
      {
        key: "typ",
        label: "Typ",
        aliases: ["typ", "art", "kategorie"],
        hint: "Krankenkasse, Klinik, Pflegeeinrichtung, Privat, Sonstige",
      },
      {
        key: "ansprechpartner",
        label: "Ansprechpartner",
        aliases: ["ansprechpartner", "kontakt", "contact"],
      },
      { key: "telefon", label: "Telefon", aliases: ["telefon", "tel", "phone"] },
      { key: "email", label: "E-Mail", aliases: ["email", "e-mail", "mail"] },
      { key: "adresse", label: "Adresse", aliases: ["adresse", "anschrift", "address"] },
      {
        key: "zahlungszielTage",
        label: "Zahlungsziel (Tage)",
        aliases: ["zahlungsziel", "zahlungsziel tage", "payment terms"],
        hint: "Zahl",
      },
      { key: "notiz", label: "Notiz", aliases: ["notiz", "bemerkung", "note"] },
    ],
    build: (m) => {
      const errors: string[] = [];
      const name = trim(m.name);
      if (!name) errors.push("Name fehlt");
      const typ =
        matchEnum(m.typ, [
          "Krankenkasse",
          "Klinik",
          "Pflegeeinrichtung",
          "Privat",
          "Sonstige",
        ] as const) ?? "Sonstige";
      const record: CustomerWrite = {
        name,
        typ,
        ansprechpartner: trim(m.ansprechpartner),
        telefon: trim(m.telefon),
        offeneRechnungen: 0,
        email: trim(m.email) || undefined,
        adresse: trim(m.adresse) || undefined,
        zahlungszielTage: trim(m.zahlungszielTage) ? toNumber(m.zahlungszielTage) : undefined,
        notiz: trim(m.notiz) || undefined,
        aktiv: true,
      };
      return {
        record: errors.length ? null : (record as unknown as Record<string, unknown>),
        errors,
      };
    },
  },

  patients: {
    label: "Patienten",
    description: "Patientenstammdaten, Mobilität und Transportbedarf.",
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "patient"] },
      { key: "telefon", label: "Telefon", aliases: ["telefon", "tel", "phone"] },
      {
        key: "mobilitaet",
        label: "Mobilität",
        aliases: ["mobilität", "mobilitaet", "mobility"],
        hint: "Gehfähig, Rollstuhl, Liegend",
      },
      {
        key: "kostentraeger",
        label: "Kostenträger",
        aliases: ["kostenträger", "kostentraeger", "kasse", "versicherung"],
      },
      { key: "hinweis", label: "Hinweis", aliases: ["hinweis", "bemerkung", "note"] },
      {
        key: "begleitperson",
        label: "Begleitperson",
        aliases: ["begleitperson", "begleitung"],
        hint: "Ja/Nein",
      },
      {
        key: "medizinischeNotiz",
        label: "Medizinische Notiz",
        aliases: ["medizinische notiz", "medizin", "diagnose"],
      },
    ],
    build: (m) => {
      const errors: string[] = [];
      const name = trim(m.name);
      if (!name) errors.push("Name fehlt");
      const record: PatientWrite = {
        name,
        telefon: trim(m.telefon) || undefined,
        mobilitaet:
          matchEnum(m.mobilitaet, ["Gehfähig", "Rollstuhl", "Liegend"] as const) ?? "Gehfähig",
        kostentraeger: trim(m.kostentraeger),
        hinweis: trim(m.hinweis),
        begleitperson: toBool(m.begleitperson),
        medizinischeNotiz: trim(m.medizinischeNotiz) || undefined,
      };
      return {
        record: errors.length ? null : (record as unknown as Record<string, unknown>),
        errors,
      };
    },
  },
};

/** Best-effort auto-map of file headers to entity fields via aliases. */
export function autoMap(entity: ImportEntity, headers: string[]): Record<string, string> {
  const cfg = ENTITY_CONFIGS[entity];
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const field of cfg.fields) {
    const hit = headers.find((h) => {
      if (used.has(h)) return false;
      const hl = h.toLowerCase().trim();
      return field.aliases.some((a) => hl === a || hl.includes(a));
    });
    if (hit) {
      mapping[field.key] = hit;
      used.add(hit);
    }
  }
  return mapping;
}
