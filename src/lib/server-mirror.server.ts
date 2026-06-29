// Server-side hydration of the legacy in-memory mirrors from persisted Supabase
// data. In the browser these mirrors are filled by the *-store hooks (prefetched
// in AppShell). Server contexts — above all the GHASI AI chat handler — must load
// them explicitly before reading the synchronous snapshots (buildKnowledgeSnapshot,
// buildBusinessTools, generateHinweise, finance/reporting helpers) so the AI Brain
// always works on real database data and never on the demo SEED_* arrays.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INITIAL_AUFTRAEGE } from "@/lib/auftraege";
import { INITIAL_FAHRER } from "@/lib/fahrer";
import { INITIAL_RECHNUNGEN } from "@/lib/finance";
import { DAUERAUFTRAEGE } from "@/lib/dauerauftraege";
import { rowToAuftrag, type OrderRow } from "@/lib/orders-shared";
import { rowToFahrer, type DriverRow } from "@/lib/drivers-shared";
import { rowToRechnung, type InvoiceRow } from "@/lib/invoices-shared";
import { rowToDauerauftrag, type RecurringRow } from "@/lib/recurring-shared";

function replace<T>(target: T[], next: T[]) {
  target.length = 0;
  target.push(...next);
}

/**
 * Loads orders, drivers, invoices and recurring orders from Supabase and mirrors
 * them into the legacy in-memory arrays. Safe to call on every server request;
 * failures are swallowed so the chat handler still responds (with whatever data
 * is already mirrored) instead of erroring out.
 */
export async function hydrateServerMirrors(): Promise<void> {
  try {
    const [orders, drivers, invoices, recurring] = await Promise.all([
      supabaseAdmin.from("orders").select("*"),
      supabaseAdmin.from("drivers").select("*"),
      supabaseAdmin.from("invoices").select("*"),
      supabaseAdmin.from("recurring_orders").select("*"),
    ]);
    if (orders.data)
      replace(
        INITIAL_AUFTRAEGE,
        orders.data.map((r) => rowToAuftrag(r as unknown as OrderRow)),
      );
    if (drivers.data)
      replace(
        INITIAL_FAHRER,
        drivers.data.map((r) => rowToFahrer(r as unknown as DriverRow)),
      );
    if (invoices.data)
      replace(
        INITIAL_RECHNUNGEN,
        invoices.data.map((r) => rowToRechnung(r as unknown as InvoiceRow)),
      );
    if (recurring.data)
      replace(
        DAUERAUFTRAEGE,
        recurring.data.map((r) => rowToDauerauftrag(r as unknown as RecurringRow)),
      );
  } catch {
    // Non-fatal: keep serving with already-mirrored data.
  }
}
