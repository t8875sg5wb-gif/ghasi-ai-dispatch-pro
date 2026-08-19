// Server-only Rollenprüfung für Beschäftigungsverhältnisse.
// Zweite Verteidigungslinie neben RLS und DB-Triggern: liefert eine klare
// deutsche Fehlermeldung, wenn eine nicht berechtigte Rolle zugreift.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export async function assertFinanzRolle(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "finanz"]);
  if (!data || data.length === 0) {
    throw new Error(
      "Kein Zugriff: Beschäftigungsverhältnisse sind Administration und Finanzen vorbehalten.",
    );
  }
}
