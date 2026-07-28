// Serverseitiges Laden der Dispatch-Datenbasis (RLS-konform über den
// Client des angemeldeten Nutzers) und Auswertung der Zuweisungskonflikte.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { Auftrag } from "@/lib/auftraege";
import { zuweisungsWarnungenFuer } from "@/lib/assignment-conflicts";
import { rowToFahrer, type DriverRow } from "@/lib/drivers-shared";
import { rowToAuftrag, type OrderRow } from "@/lib/orders-shared";
import { rowToFahrzeug, type VehicleRow } from "@/lib/vehicles-shared";

/**
 * Warnt, blockiert aber nicht: der Auftrag ist zum Aufrufzeitpunkt bereits
 * gespeichert. Fehler beim Nachladen dürfen das Speichern nicht kippen.
 */
export async function berechneZuweisungsWarnungen(
  supabase: SupabaseClient<Database>,
  auftragId: string,
): Promise<string[]> {
  try {
    const [orders, drivers, vehicles] = await Promise.all([
      supabase.from("orders").select("*"),
      supabase.from("drivers").select("*"),
      supabase.from("vehicles").select("*"),
    ]);
    if (orders.error || drivers.error || vehicles.error) return [];
    const auftraege: Auftrag[] = (orders.data ?? []).map((r) =>
      rowToAuftrag(r as unknown as OrderRow),
    );
    const fahrer = (drivers.data ?? []).map((r) => rowToFahrer(r as unknown as DriverRow));
    const fahrzeuge = (vehicles.data ?? []).map((r) => rowToFahrzeug(r as unknown as VehicleRow));
    return zuweisungsWarnungenFuer(auftragId, auftraege, fahrer, fahrzeuge);
  } catch (e) {
    console.error("Zuweisungswarnungen konnten nicht berechnet werden:", e);
    return [];
  }
}
