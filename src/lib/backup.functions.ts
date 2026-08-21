// Admin-only full data export ("Backup"). Reads every persisted table of the
// public schema as the signed-in user (RLS applies; only admins can read
// everything) and returns the raw rows. Reads are paginated, so tables with
// more than 1000 rows are exported completely. The client turns this into a
// ZIP of CSV files.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BACKUP_TABLES, collectBackupData, type BackupClient } from "@/lib/backup-tables";

export { BACKUP_TABLES };
export type { BackupData } from "@/lib/backup-tables";

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

    const { result, failedTables } = await collectBackupData(
      context.supabase as unknown as BackupClient,
      BACKUP_TABLES,
    );

    // Return as a JSON string to keep the RPC return type serializable.
    return { json: JSON.stringify(result), failedTables };
  });
