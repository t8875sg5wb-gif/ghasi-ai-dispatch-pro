// Server-side hydration of the legacy in-memory mirrors from persisted Supabase
// data. In the browser these mirrors are filled by the *-store hooks (prefetched
// in AppShell). Server contexts — above all the GHASI AI chat handler — must load
// them explicitly before reading the synchronous snapshots (buildKnowledgeSnapshot,
// buildBusinessTools, generateHinweise, finance/reporting helpers) so the AI Brain
// always works on real database data and never on the demo SEED_* arrays.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INITIAL_AUFTRAEGE } from "@/lib/auftraege";
import { INITIAL_FAHRER } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import { INITIAL_RECHNUNGEN } from "@/lib/finance";
import { DAUERAUFTRAEGE } from "@/lib/dauerauftraege";
import {
  PATIENTEN,
  KUNDEN,
  KRANKENKASSEN,
  KRANKENHAEUSER,
  DIALYSEZENTREN,
  PFLEGEHEIME,
} from "@/lib/stammdaten";
import { rowToAuftrag, type OrderRow } from "@/lib/orders-shared";
import { rowToFahrer, type DriverRow } from "@/lib/drivers-shared";
import { rowToRechnung, type InvoiceRow } from "@/lib/invoices-shared";
import { rowToDauerauftrag, type RecurringRow } from "@/lib/recurring-shared";
import { rowToPatient, type PatientRow } from "@/lib/patients-shared";
import { rowToFahrzeug, type VehicleRow } from "@/lib/vehicles-shared";
import { rowToKunde, type CustomerRow } from "@/lib/customers-shared";
import { rowToKrankenkasse, type InsurerRow } from "@/lib/insurers-shared";
import { rowToEinrichtung, type FacilityRow } from "@/lib/facilities-shared";

function replace<T>(target: T[], next: T[]) {
  target.length = 0;
  target.push(...next);
}

/**
 * Loads all AI-visible entities from Supabase and mirrors them into the legacy
 * in-memory arrays: orders, drivers, invoices, recurring orders, patients,
 * vehicles, customers, insurers and facilities (split by type into hospitals,
 * dialysis centres and care homes).
 *
 * Mirrors are only replaced when the query succeeded — an empty but successful
 * result clears the demo seed data, while a failed query leaves the previous
 * mirror untouched. Failures are logged and swallowed so the chat handler still
 * responds instead of erroring out.
 */
export async function hydrateServerMirrors(): Promise<void> {
  try {
    const [orders, drivers, invoices, recurring, patients, vehicles, customers, insurers, facilities] =
      await Promise.all([
        supabaseAdmin.from("orders").select("*"),
        supabaseAdmin.from("drivers").select("*"),
        supabaseAdmin.from("invoices").select("*"),
        supabaseAdmin.from("recurring_orders").select("*"),
        supabaseAdmin.from("patients").select("*"),
        supabaseAdmin.from("vehicles").select("*"),
        supabaseAdmin.from("customers").select("*"),
        supabaseAdmin.from("insurers").select("*"),
        supabaseAdmin.from("facilities").select("*"),
      ]);

    if (!orders.error)
      replace(
        INITIAL_AUFTRAEGE,
        (orders.data ?? []).map((r) => rowToAuftrag(r as unknown as OrderRow)),
      );
    if (!drivers.error)
      replace(
        INITIAL_FAHRER,
        (drivers.data ?? []).map((r) => rowToFahrer(r as unknown as DriverRow)),
      );
    if (!invoices.error)
      replace(
        INITIAL_RECHNUNGEN,
        (invoices.data ?? []).map((r) => rowToRechnung(r as unknown as InvoiceRow)),
      );
    if (!recurring.error)
      replace(
        DAUERAUFTRAEGE,
        (recurring.data ?? []).map((r) => rowToDauerauftrag(r as unknown as RecurringRow)),
      );
    if (!patients.error)
      replace(
        PATIENTEN,
        (patients.data ?? []).map((r) => rowToPatient(r as unknown as PatientRow)),
      );
    if (!vehicles.error)
      replace(
        INITIAL_FAHRZEUGE,
        (vehicles.data ?? []).map((r) => rowToFahrzeug(r as unknown as VehicleRow)),
      );
    if (!customers.error)
      replace(
        KUNDEN,
        (customers.data ?? []).map((r) => rowToKunde(r as unknown as CustomerRow)),
      );
    if (!insurers.error)
      replace(
        KRANKENKASSEN,
        (insurers.data ?? []).map((r) => rowToKrankenkasse(r as unknown as InsurerRow)),
      );
    if (!facilities.error) {
      const alle = (facilities.data ?? []).map((r) => rowToEinrichtung(r as unknown as FacilityRow));
      replace(
        KRANKENHAEUSER,
        alle.filter((e) => e.typ === "krankenhaus"),
      );
      replace(
        DIALYSEZENTREN,
        alle.filter((e) => e.typ === "dialyse"),
      );
      replace(
        PFLEGEHEIME,
        alle.filter((e) => e.typ === "pflegeheim"),
      );
    }
  } catch (error) {
    // Non-fatal: keep serving with already-mirrored data.
    console.error("[server-mirror] Hydration fehlgeschlagen:", error);
  }
}
