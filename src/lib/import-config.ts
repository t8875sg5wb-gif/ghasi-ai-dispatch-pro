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
  const s = trim(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
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
  const de = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/);
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

/* ------------------------------ entity configs ------------------------------ */

export const ENTITY_CONFIGS: Record<ImportEntity, EntityConfig> = {
  drivers: {
    label: "Fahrer",
    description: "Personal mit Kontaktdaten, Vertrag und Nachweisfristen.",
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "fahrer", "vorname nachname"] },
      { key: "telefon", label: "Telefon", aliases: ["telefon", "tel", "handy", "mobil", "phone"] },
      { key: "email", label: "E-Mail", aliases: ["email", "e-mail", "mail"] },
      { key: "adresse", label: "Adresse", aliases: ["adresse", "anschrift", "address"] },
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
        aliases: ["führerschein", "fuehrerschein", "fs bis", "führerschein bis"],
        hint: "Datum",
      },
      {
        key: "pScheinBis",
        label: "P-Schein gültig bis",
        aliases: ["p-schein", "pschein", "personenbeförderung"],
        hint: "Datum",
      },
      {
        key: "ersteHilfeBis",
        label: "Erste-Hilfe gültig bis",
        aliases: ["erste hilfe", "erste-hilfe", "ersthelfer"],
        hint: "Datum",
      },
    ],
    build: (m) => {
      const errors: string[] = [];
      const name = trim(m.name);
      if (!name) errors.push("Name fehlt");
      const record: DriverWrite = {
        name,
        foto: null,
        telefon: trim(m.telefon),
        email: trim(m.email),
        adresse: trim(m.adresse),
        fuehrerschein: { gueltigBis: toISODate(m.fuehrerscheinBis) },
        pSchein: { gueltigBis: toISODate(m.pScheinBis) },
        ersteHilfe: { gueltigBis: toISODate(m.ersteHilfeBis) },
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
      return { record: errors.length ? null : (record as unknown as Record<string, unknown>), errors };
    },
  },

  vehicles: {
    label: "Fahrzeuge",
    description: "Flotte mit Kennzeichen, Typ, Ausstattung und Fristen.",
    fields: [
      { key: "kennzeichen", label: "Kennzeichen", required: true, aliases: ["kennzeichen", "kfz", "plate"] },
      { key: "marke", label: "Marke", aliases: ["marke", "hersteller", "brand"] },
      { key: "modell", label: "Modell", aliases: ["modell", "model", "typbezeichnung"] },
      { key: "baujahr", label: "Baujahr", aliases: ["baujahr", "jahr", "year"], hint: "Zahl" },
      { key: "typ", label: "Typ", aliases: ["typ", "fahrzeugtyp", "art"], hint: "z. B. KTW" },
      { key: "sitzplaetze", label: "Sitzplätze", aliases: ["sitzplätze", "sitze", "plätze"], hint: "Zahl" },
      { key: "kraftstoff", label: "Kraftstoff", aliases: ["kraftstoff", "treibstoff", "fuel"] },
      { key: "standort", label: "Standort", aliases: ["standort", "ort", "location"] },
      { key: "kilometerstand", label: "Kilometerstand", aliases: ["kilometerstand", "km", "laufleistung"], hint: "Zahl" },
      { key: "tuevBis", label: "TÜV bis", aliases: ["tüv", "tuev", "hu", "hauptuntersuchung"], hint: "Datum" },
      { key: "versicherung", label: "Versicherung", aliases: ["versicherung", "insurance"] },
    ],
    build: (m) => {
      const errors: string[] = [];
      const kennzeichen = trim(m.kennzeichen);
      if (!kennzeichen) errors.push("Kennzeichen fehlt");
      const record: VehicleWrite = {
        kennzeichen,
        marke: trim(m.marke),
        modell: trim(m.modell),
        baujahr: toNumber(m.baujahr, new Date().getFullYear()),
        typ: (trim(m.typ) || "KTW") as VehicleWrite["typ"],
        rollstuhlGeeignet: false,
        liegendGeeignet: false,
        sitzplaetze: toNumber(m.sitzplaetze, 1),
        status: "frei",
        fahrer: null,
        standort: trim(m.standort),
        gps: { lat: 52.29, lng: 8.9 },
        kilometerstand: toNumber(m.kilometerstand),
        tankstand: 100,
        kraftstoff: (trim(m.kraftstoff) || "Diesel") as VehicleWrite["kraftstoff"],
        verbrauch: 0,
        reichweite: 0,
        kostenProKm: 0,
        tagesumsatz: 0,
        tagesgewinn: 0,
        monatsumsatz: 0,
        monatsgewinn: 0,
        tuevBis: toISODate(m.tuevBis),
        oelwechselBei: 0,
        naechsteWartung: "",
        reifenstatus: "gut",
        reparaturen: [],
        versicherung: trim(m.versicherung),
        versicherungBis: "",
        leasingrate: 0,
        leasingEnde: "",
        dokumente: [],
        fotos: [],
        notizen: "",
      };
      return { record: errors.length ? null : (record as unknown as Record<string, unknown>), errors };
    },
  },

  customers: {
    label: "Kunden",
    description: "Auftraggeber, Kassen und Vertragspartner.",
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "kunde", "firma"] },
      { key: "typ", label: "Typ", aliases: ["typ", "art", "kategorie"], hint: "Krankenkasse, Klinik, Pflegeeinrichtung, Privat, Sonstige" },
      { key: "ansprechpartner", label: "Ansprechpartner", aliases: ["ansprechpartner", "kontakt", "contact"] },
      { key: "telefon", label: "Telefon", aliases: ["telefon", "tel", "phone"] },
      { key: "email", label: "E-Mail", aliases: ["email", "e-mail", "mail"] },
      { key: "adresse", label: "Adresse", aliases: ["adresse", "anschrift", "address"] },
      { key: "zahlungszielTage", label: "Zahlungsziel (Tage)", aliases: ["zahlungsziel", "zahlungsziel tage", "payment terms"], hint: "Zahl" },
      { key: "notiz", label: "Notiz", aliases: ["notiz", "bemerkung", "note"] },
    ],
    build: (m) => {
      const errors: string[] = [];
      const name = trim(m.name);
      if (!name) errors.push("Name fehlt");
      const typ =
        matchEnum(m.typ, ["Krankenkasse", "Klinik", "Pflegeeinrichtung", "Privat", "Sonstige"] as const) ??
        "Sonstige";
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
      return { record: errors.length ? null : (record as unknown as Record<string, unknown>), errors };
    },
  },

  patients: {
    label: "Patienten",
    description: "Patientenstammdaten, Mobilität und Transportbedarf.",
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "patient"] },
      { key: "telefon", label: "Telefon", aliases: ["telefon", "tel", "phone"] },
      { key: "mobilitaet", label: "Mobilität", aliases: ["mobilität", "mobilitaet", "mobility"], hint: "Gehfähig, Rollstuhl, Liegend" },
      { key: "kostentraeger", label: "Kostenträger", aliases: ["kostenträger", "kostentraeger", "kasse", "versicherung"] },
      { key: "hinweis", label: "Hinweis", aliases: ["hinweis", "bemerkung", "note"] },
      { key: "begleitperson", label: "Begleitperson", aliases: ["begleitperson", "begleitung"], hint: "Ja/Nein" },
      { key: "medizinischeNotiz", label: "Medizinische Notiz", aliases: ["medizinische notiz", "medizin", "diagnose"] },
    ],
    build: (m) => {
      const errors: string[] = [];
      const name = trim(m.name);
      if (!name) errors.push("Name fehlt");
      const record: PatientWrite = {
        name,
        telefon: trim(m.telefon) || undefined,
        mobilitaet: matchEnum(m.mobilitaet, ["Gehfähig", "Rollstuhl", "Liegend"] as const) ?? "Gehfähig",
        kostentraeger: trim(m.kostentraeger),
        hinweis: trim(m.hinweis),
        begleitperson: toBool(m.begleitperson),
        medizinischeNotiz: trim(m.medizinischeNotiz) || undefined,
      };
      return { record: errors.length ? null : (record as unknown as Record<string, unknown>), errors };
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
