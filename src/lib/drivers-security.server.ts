// Server-only Rollenprüfung für lohnrelevante Fahrer-Felder.
// Nur `monatsbrutto` und `beschaeftigungsart` sind Administration/Finanzen
// vorbehalten. Alle übrigen Fahrer-Felder (Telefon, Nachweise, Status …)
// bleiben unverändert für Admin/Disposition pflegbar.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { assertFinanzRolle } from "@/lib/employment-security.server";

/** Felder, deren Änderung eine Finanz-/Admin-Rolle erfordert. */
export const LOHN_RELEVANTE_FAHRER_FELDER = ["monatsbrutto", "beschaeftigungsart"] as const;

/** Prüft, ob ein Patch lohnrelevante Felder berührt (Anwesenheit des Schlüssels). */
export function beruehrtLohnFelder(values: Record<string, unknown>): boolean {
  return LOHN_RELEVANTE_FAHRER_FELDER.some((k) => k in values);
}

/**
 * Wirft, wenn ein Patch Gehaltsfelder ändert und der Nutzer keine
 * Finanz-/Admin-Rolle besitzt.
 */
export async function assertLohnFelderBerechtigung(
  supabase: SupabaseClient<Database>,
  userId: string,
  values: Record<string, unknown>,
): Promise<void> {
  if (!beruehrtLohnFelder(values)) return;
  try {
    await assertFinanzRolle(supabase, userId);
  } catch {
    throw new Error(
      "Kein Zugriff: Monatsbrutto und Beschäftigungsart dürfen nur von Administration oder Finanzen geändert werden.",
    );
  }
}
