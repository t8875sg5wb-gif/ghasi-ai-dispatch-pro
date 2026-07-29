// Server functions for company-wide settings (Firmenstammdaten & Steuerprofil).
// A single-row ("singleton") table. Reads: Admin & Finanz. Writes: admin.
// Typen und Mapper liegen in company-settings-shared.ts, damit andere
// Serverfunktionen (z. B. Rechnungserzeugung) dieselbe Logik nutzen können.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_COMPANY_SETTINGS,
  loadCompanySettings,
  rowToSettings,
  settingsToRow,
  type CompanyRow,
  type CompanySettings,
} from "@/lib/company-settings-shared";

export { DEFAULT_COMPANY_SETTINGS, type CompanySettings } from "@/lib/company-settings-shared";

export const getCompanySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanySettings> => {
    return loadCompanySettings(context.supabase);
  });

export const saveCompanySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: CompanySettings) => {
    if (!data || typeof data.firma !== "string") throw new Error("Ungültige Einstellungen");
    return data;
  })
  .handler(async ({ data, context }): Promise<CompanySettings> => {
    const row = settingsToRow({ ...DEFAULT_COMPANY_SETTINGS, ...data });
    const { data: saved, error } = await context.supabase
      .from("company_settings")
      .upsert(row as never, { onConflict: "singleton" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToSettings(saved as unknown as CompanyRow);
  });
