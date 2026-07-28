// Gemeinsame Existenzprüfungen der Identitätskette (Patient / Kostenträger).
// Bewusst hier zentral, damit Aufträge und Daueraufträge dieselbe Prüfung
// verwenden und nicht zwei Kopien auseinanderlaufen.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export async function assertPatientExists(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<void> {
  const { data } = await supabase.from("patients").select("id").eq("id", patientId).maybeSingle();
  if (!data) throw new Error("Unbekannter Patient – Verknüpfung nicht möglich.");
}

export async function assertInsurerExists(
  supabase: SupabaseClient<Database>,
  insurerId: string,
): Promise<void> {
  const { data } = await supabase.from("insurers").select("id").eq("id", insurerId).maybeSingle();
  if (!data) throw new Error("Unbekannter Kostenträger – Verknüpfung nicht möglich.");
}
