// Admin-only full data export ("Backup"). Reads every persisted public table
// through one hardened PostgreSQL snapshot RPC so all rows come from the same
// statement snapshot. The client turns the validated result into a ZIP.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { collectConsistentBackupData, type ConsistentBackupClient } from "@/lib/backup-consistent";
import { BACKUP_TABLES } from "@/lib/backup-tables";
import { createRestoreBackup } from "@/lib/backup-restore";
import type { BackupDocumentDownloadSource } from "@/lib/backup-document-files";

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

    const { result, snapshotId } = await collectConsistentBackupData(
      context.supabase as unknown as ConsistentBackupClient,
    );

    const backup = createRestoreBackup(result, snapshotId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const documentSources: BackupDocumentDownloadSource[] = [];
    for (const item of backup.manifest.recovery.storageObjects) {
      const { data, error } = await supabaseAdmin.storage
        .from("documents")
        .createSignedUrl(item.path, 600);
      if (error || !data?.signedUrl) {
        throw new Error(
          `Dokumentdatei konnte nicht fuer das Backup bereitgestellt werden: ${item.path}.`,
        );
      }
      documentSources.push({ path: item.path, signedUrl: data.signedUrl });
    }

    // Database snapshot and every active storage object belong to one fail-closed export.
    return {
      json: JSON.stringify(result),
      failedTables: [] as string[],
      snapshotId,
      documentSources,
    };
  });
