// Admin-only full data export ("Backup"). Reads every persisted domain table
// as the signed-in user (RLS applies; only admins can read everything) and
// returns the raw rows. The client turns this into a ZIP of CSV files.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Tables covered by the backup, in a sensible export order. */
export const BACKUP_TABLES = [
  "orders",
  "recurring_orders",
  "drivers",
  "vehicles",
  "customers",
  "patients",
  "facilities",
  "insurers",
  "insurance_policies",
  "insurer_contracts",
  "leasing_contracts",
  "calls",
  "invoices",
  "documents",
  "driver_shifts",
  "vehicle_trips",
  "conversations",
  "communication_drafts",
] as const;

export type BackupData = Record<string, Record<string, unknown>[]>;

export const exportAllData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin gate (same pattern as the user administration functions).
    const { data: adminRolle, error: rollenFehler } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (rollenFehler || !adminRolle) {
      throw new Error("Kein Zugriff: Der Datenexport ist Administratoren vorbehalten.");
    }

    const sb = context.supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => Promise<{ data: Record<string, unknown>[] | null }>;
      };
    };

    const result: BackupData = {};
    for (const table of BACKUP_TABLES) {
      try {
        const { data } = await sb.from(table).select("*");
        result[table] = data ?? [];
      } catch {
        result[table] = [];
      }
    }
    return result;
  });
