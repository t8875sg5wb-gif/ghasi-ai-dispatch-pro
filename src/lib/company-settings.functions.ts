// Server functions for company-wide settings (Firmenstammdaten & Steuerprofil).
// A single-row ("singleton") table. Reads: any authenticated user. Writes: admin.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  datevBeraterNr: "",
  datevMandantNr: "",
  datevErloeskonto: "8120",
  datevGegenkonto: "10000",
};

interface CompanyRow {
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
  datev_berater_nr?: string;
  datev_mandant_nr?: string;
  datev_erloeskonto?: string;
  datev_gegenkonto?: string;
}

function rowToSettings(r: CompanyRow): CompanySettings {
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
    datevBeraterNr: r.datev_berater_nr ?? "",
    datevMandantNr: r.datev_mandant_nr ?? "",
    datevErloeskonto: r.datev_erloeskonto ?? "8120",
    datevGegenkonto: r.datev_gegenkonto ?? "10000",
  };
}

export const getCompanySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanySettings> => {
    const { data, error } = await context.supabase
      .from("company_settings")
      .select("*")
      .eq("singleton", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULT_COMPANY_SETTINGS;
    return rowToSettings(data as unknown as CompanyRow);
  });

export const saveCompanySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: CompanySettings) => {
    if (!data || typeof data.firma !== "string") throw new Error("Ungültige Einstellungen");
    return data;
  })
  .handler(async ({ data, context }): Promise<CompanySettings> => {
    const row = {
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
      datev_berater_nr: data.datevBeraterNr,
      datev_mandant_nr: data.datevMandantNr,
      datev_erloeskonto: data.datevErloeskonto,
      datev_gegenkonto: data.datevGegenkonto,
    };
    const { data: saved, error } = await context.supabase
      .from("company_settings")
      .upsert(row as never, { onConflict: "singleton" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToSettings(saved as unknown as CompanyRow);
  });
