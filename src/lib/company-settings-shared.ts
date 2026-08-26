// Shared (client- und serverseitig nutzbare) Typen und Mapper für die
// Firmenstammdaten. Bewusst OHNE createServerFn, damit sowohl
// company-settings.functions.ts als auch andere Serverfunktionen
// (z. B. invoices.functions.ts) dieselbe Mapper-Logik verwenden können.
import type { SteuerModus } from "@/lib/steuer";
import { DEFAULT_STEUER_MODUS } from "@/lib/steuer";

export interface CompanySettings {
  firma: string;
  rechtsform: string;
  inhaber: string;
  adresse: string;
  telefon: string;
  email: string;
  steuernummer: string;
  ustId: string;
  /** Institutionskennzeichen (IK) für die §133-SGB-V-Abrechnung. */
  ikNummer: string;
  gewerbesteuerHebesatz: number;
  steuerModus: SteuerModus;
  /**
   * Wurde der USt-Modus bewusst durch einen Admin bestätigt (= gespeichert)?
   * Ohne Bestätigung dürfen keine Rechnungen erzeugt werden, da § 4 Nr. 17b
   * UStG nicht automatisch für jedes Fahrzeug/Geschäftsmodell gilt.
   */
  steuerModusBestaetigt: boolean;
  // --- Strukturierte Adresse + Zahlungsangabe (XRechnung / EN 16931) ---
  // XRechnung verlangt getrennte Adressfelder, kein Freitext. `adresse` bleibt
  // als Anzeigetext (PDF, KI, Suche) erhalten und wird nicht ersetzt.
  adresseStrasse: string;
  adresseHausnummer: string;
  adressePlz: string;
  adresseOrt: string;
  /** ISO-3166-1-Alpha-2, z. B. "DE". */
  adresseLand: string;
  /** IBAN für die Zahlungsangabe in der Rechnung. */
  iban: string;
  /**
   * Wurden die strukturierten Firmendaten (Adresse + IBAN) bewusst von einem
   * Admin bestätigt (= mit vollständigen Werten gespeichert)? Analog zu
   * `steuerModusBestaetigt`. Ohne Bestätigung: kein XRechnung-Export.
   */
  xrechnungDatenBestaetigt: boolean;
  // DATEV-Export (Steuerberater)
  datevBeraterNr: string;
  datevMandantNr: string;
  /** SKR03 Erlöskonto für steuerfreie Umsätze §4 Nr.17b (Standard 8120). */
  datevErloeskonto: string;
  /** Debitoren-Sammelkonto / Gegenkonto (Standard 10000). */
  datevGegenkonto: string;
  // --- Betriebskosten-Annahmen (für Kostenschätzungen) ---
  /** Angenommener Kraftstoffpreis €/l für die Kraftstoffkosten-Schätzung. */
  dieselpreis: number;
  /** Durchschnittliche Arbeitstage pro Monat für Monats-Hochrechnungen. */
  arbeitstageMonat: number;
  /**
   * Betriebliche Aufbewahrungsdauer für KI-Chatverläufe in Monaten (1–120).
   * Keine gesetzliche Frist und ausdrücklich NICHT von AUFBEWAHRUNG_JAHRE
   * (GoBD/Belege) abgeleitet.
   */
  chatRetentionMonths: number;
  /**
   * Aufbewahrungsdauer für MCP-Agenten-Audit-Logs im aktiven Bereich (1–120
   * Monate). Ältere Einträge werden NICHT gelöscht, sondern automatisch in
   * `ai_audit_log_archive` verschoben – der Prüfpfad bleibt vollständig.
   */
  mcpAuditRetentionMonths: number;
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  firma: "Krankentransport Minden",
  rechtsform: "Einzelunternehmen",
  inhaber: "",
  adresse: "Simeonstraße 1, 32423 Minden",
  telefon: "0571 000000",
  email: "kontakt@krankentransport-minden.de",
  steuernummer: "",
  ustId: "",
  ikNummer: "",
  gewerbesteuerHebesatz: 460,
  steuerModus: DEFAULT_STEUER_MODUS,
  steuerModusBestaetigt: false,
  adresseStrasse: "",
  adresseHausnummer: "",
  adressePlz: "",
  adresseOrt: "",
  adresseLand: "DE",
  iban: "",
  xrechnungDatenBestaetigt: false,
  datevBeraterNr: "",
  datevMandantNr: "",
  datevErloeskonto: "8120",
  datevGegenkonto: "10000",
  dieselpreis: 1.75,
  arbeitstageMonat: 21,
  chatRetentionMonths: 12,
};

export interface CompanyRow {
  firma: string;
  rechtsform: string;
  inhaber: string;
  adresse: string;
  telefon: string;
  email: string;
  steuernummer: string;
  ust_id: string;
  ik_nummer?: string;
  gewerbesteuer_hebesatz: number;
  steuer_modus: string;
  steuer_modus_bestaetigt?: boolean | null;
  adresse_strasse?: string | null;
  adresse_hausnummer?: string | null;
  adresse_plz?: string | null;
  adresse_ort?: string | null;
  adresse_land?: string | null;
  iban?: string | null;
  xrechnung_daten_bestaetigt?: boolean | null;
  datev_berater_nr?: string;
  datev_mandant_nr?: string;
  datev_erloeskonto?: string;
  datev_gegenkonto?: string;
  betriebskosten_dieselpreis?: number | string;
  betriebskosten_arbeitstage?: number | string;
  chat_retention_months?: number | string;
}

export function rowToSettings(r: CompanyRow): CompanySettings {
  return {
    firma: r.firma ?? "",
    rechtsform: r.rechtsform ?? "Einzelunternehmen",
    inhaber: r.inhaber ?? "",
    adresse: r.adresse ?? "",
    telefon: r.telefon ?? "",
    email: r.email ?? "",
    steuernummer: r.steuernummer ?? "",
    ustId: r.ust_id ?? "",
    ikNummer: r.ik_nummer ?? "",
    gewerbesteuerHebesatz: Number(r.gewerbesteuer_hebesatz ?? 460),
    steuerModus: (r.steuer_modus as SteuerModus) ?? DEFAULT_STEUER_MODUS,
    steuerModusBestaetigt: r.steuer_modus_bestaetigt === true,
    adresseStrasse: r.adresse_strasse ?? "",
    adresseHausnummer: r.adresse_hausnummer ?? "",
    adressePlz: r.adresse_plz ?? "",
    adresseOrt: r.adresse_ort ?? "",
    adresseLand: r.adresse_land ?? "DE",
    iban: r.iban ?? "",
    xrechnungDatenBestaetigt: r.xrechnung_daten_bestaetigt === true,
    datevBeraterNr: r.datev_berater_nr ?? "",
    datevMandantNr: r.datev_mandant_nr ?? "",
    datevErloeskonto: r.datev_erloeskonto ?? "8120",
    datevGegenkonto: r.datev_gegenkonto ?? "10000",
    dieselpreis: Number(r.betriebskosten_dieselpreis ?? 1.75),
    arbeitstageMonat: Number(r.betriebskosten_arbeitstage ?? 21),
    chatRetentionMonths: Number(r.chat_retention_months ?? 12),
  };
}

/** Zeile für das Upsert der Einstellungen. Speichern gilt als Bestätigung. */
export function settingsToRow(data: CompanySettings): Record<string, unknown> {
  return {
    singleton: 1,
    firma: data.firma,
    rechtsform: data.rechtsform,
    inhaber: data.inhaber,
    adresse: data.adresse,
    telefon: data.telefon,
    email: data.email,
    steuernummer: data.steuernummer,
    ust_id: data.ustId,
    ik_nummer: data.ikNummer,
    gewerbesteuer_hebesatz: data.gewerbesteuerHebesatz,
    steuer_modus: data.steuerModus,
    // Bewusstes Speichern durch einen Admin = Bestätigung des USt-Modus.
    steuer_modus_bestaetigt: true,
    adresse_strasse: data.adresseStrasse,
    adresse_hausnummer: data.adresseHausnummer,
    adresse_plz: data.adressePlz,
    adresse_ort: data.adresseOrt,
    adresse_land: (data.adresseLand || "DE").toUpperCase(),
    iban: (data.iban || "").replace(/\s+/g, ""),
    // Bestätigung nur, wenn die XRechnungs-Pflichtfelder wirklich gefüllt sind
    // (nie automatisch aus dem Freitextfeld geraten).
    xrechnung_daten_bestaetigt: firmenDatenXrechnungVollstaendig(data),
    datev_berater_nr: data.datevBeraterNr,
    datev_mandant_nr: data.datevMandantNr,
    datev_erloeskonto: data.datevErloeskonto,
    datev_gegenkonto: data.datevGegenkonto,
    betriebskosten_dieselpreis: data.dieselpreis,
    betriebskosten_arbeitstage: data.arbeitstageMonat,
    chat_retention_months: Math.min(
      120,
      Math.max(1, Math.round(Number(data.chatRetentionMonths) || 12)),
    ),
  };
}

interface MinimalClient {
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        col: string,
        val: number,
      ) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
  };
}

/** Lädt die Firmeneinstellungen mit einem beliebigen Supabase-Client. */
export async function loadCompanySettings(client: unknown): Promise<CompanySettings> {
  const { data, error } = await (client as MinimalClient)
    .from("company_settings")
    .select("*")
    .eq("singleton", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_COMPANY_SETTINGS;
  return rowToSettings(data as CompanyRow);
}

/** Sind Adresse (strukturiert) und IBAN vollständig für einen XRechnung-Export? */
export function firmenDatenXrechnungVollstaendig(data: CompanySettings): boolean {
  return Boolean(
    data.adresseStrasse?.trim() &&
    data.adressePlz?.trim() &&
    data.adresseOrt?.trim() &&
    (data.adresseLand ?? "").trim() &&
    data.iban?.trim(),
  );
}

export const STEUER_MODUS_UNBESTAETIGT_FEHLER =
  "Bitte zuerst den Umsatzsteuer-Modus in den Einstellungen bestätigen (Speichern genügt).";

/**
 * Lädt die Firmeneinstellungen und stellt sicher, dass der USt-Modus bestätigt
 * wurde. Wird vor jeder Erzeugung realer Rechnungen aufgerufen.
 */
export async function requireBestaetigtenSteuerModus(client: unknown): Promise<CompanySettings> {
  const company = await loadCompanySettings(client);
  if (!company.steuerModusBestaetigt) throw new Error(STEUER_MODUS_UNBESTAETIGT_FEHLER);
  return company;
}
