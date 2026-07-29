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

/**
 * Identitätskette: Eine Fahrerzuordnung wird ausschließlich über die stabile
 * `drivers.id` gesetzt. Es gibt bewusst KEINEN Namensabgleich mehr.
 * Anzeigename und `fahrer_user_id` werden vom DB-Trigger
 * `enforce_order_assignment` aus dem Fahrerdatensatz abgeleitet.
 */
export async function assertDriverExists(
  supabase: SupabaseClient<Database>,
  fahrerId: string,
): Promise<void> {
  const { data } = await supabase.from("drivers").select("id").eq("id", fahrerId).maybeSingle();
  if (!data) throw new Error("Unbekannter Fahrer – Zuordnung nicht möglich.");
}

/**
 * Identitätskette Fahrzeug: die Zuordnung läuft ausschließlich über die stabile
 * `vehicles.id`. Das Kennzeichen wird vom DB-Trigger `enforce_order_assignment`
 * daraus abgeleitet.
 */
export async function assertVehicleExists(
  supabase: SupabaseClient<Database>,
  fahrzeugId: string,
): Promise<void> {
  const { data } = await supabase.from("vehicles").select("id").eq("id", fahrzeugId).maybeSingle();
  if (!data) throw new Error("Unbekanntes Fahrzeug – Zuordnung nicht möglich.");
}
