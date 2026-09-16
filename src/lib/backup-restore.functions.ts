import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BackupDocumentFileManifestEntry } from "@/lib/backup-document-files";
import { parseRestoreBackup, type RestoreBackup } from "@/lib/backup-restore";
import { validateRestoreDocumentManifest } from "@/lib/backup-restore-documents";

interface RestoreRequest {
  backupJson: string;
  documentManifest: BackupDocumentFileManifestEntry[];
}

interface ExecuteRestoreRequest extends RestoreRequest {
  planToken: string;
}

function parseRequest(value: unknown, execute = false): RestoreRequest | ExecuteRestoreRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Restore-Anfrage ist ungueltig.");
  const input = value as Record<string, unknown>;
  if (typeof input.backupJson !== "string" || !Array.isArray(input.documentManifest)) {
    throw new Error("Restore-Anfrage ist unvollstaendig.");
  }
  if (execute && typeof input.planToken !== "string") throw new Error("Restore-Plan fehlt.");
  return input as unknown as RestoreRequest | ExecuteRestoreRequest;
}
async function assertAdmin(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Restore ist Administratoren vorbehalten.");
}

function assertBackupContainsAdmin(backup: RestoreBackup): void {
  const hasAdmin = (backup.data.user_roles ?? []).some(
    (row) => row.role === "admin" && typeof row.user_id === "string" && row.user_id.length > 0,
  );
  if (!hasAdmin)
    throw new Error("Restore abgebrochen: Das Backup enthaelt keine Administratorrolle.");
}

async function assertAuthUsersExist(backup: RestoreBackup): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (const userId of backup.manifest.recovery.authUserIds) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) throw new Error(`Auth-Pruefung fehlgeschlagen (${userId}): ${error.message}`);
    if (data?.user?.id !== userId)
      throw new Error(`Restore abgebrochen: Auth-Benutzer fehlt: ${userId}.`);
  }
}
export const prepareRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): RestoreRequest => parseRequest(data) as RestoreRequest)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const backup = parseRestoreBackup(data.backupJson);
    const manifest = validateRestoreDocumentManifest(backup, data.documentManifest);
    assertBackupContainsAdmin(backup);
    await assertAuthUsersExist(backup);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { prepareRestoreStoragePlan } = await import("@/lib/backup-restore-storage.server");
    const prepared = await prepareRestoreStoragePlan(
      backup,
      manifest,
      context.userId,
      supabaseAdmin,
    );
    return {
      ...prepared,
      snapshotId: backup.manifest.databaseSnapshotId,
      createdAt: backup.manifest.createdAt,
      tableCount: backup.manifest.tableCount,
      totalRows: backup.manifest.totalRows,
      documentCount: manifest.length,
    };
  });
export const executeRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: unknown): ExecuteRestoreRequest => parseRequest(data, true) as ExecuteRestoreRequest,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const backup = parseRestoreBackup(data.backupJson);
    const manifest = validateRestoreDocumentManifest(backup, data.documentManifest);
    assertBackupContainsAdmin(backup);
    await assertAuthUsersExist(backup);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { cleanupRestoreStorage, verifyAndPromoteRestoreStorage } =
      await import("@/lib/backup-restore-storage.server");
    let promoted: { createdFinalPaths: string[]; stagingPaths: string[] } | undefined;
    try {
      promoted = await verifyAndPromoteRestoreStorage(
        data.planToken,
        backup,
        manifest,
        context.userId,
        supabaseAdmin,
      );
      const rpcClient = context.supabase as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>,
        ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
      const { data: rpcData, error: rpcError } = await rpcClient.rpc("ghasi_restore_backup", {
        p_data: backup.data,
        p_row_counts: backup.manifest.rowCounts,
      });
      if (rpcError) throw new Error(`Datenbank-Restore fehlgeschlagen: ${rpcError.message}`);

      let cleanupWarning: string | null = null;
      try {
        await cleanupRestoreStorage(supabaseAdmin, promoted.stagingPaths);
      } catch (error) {
        cleanupWarning =
          error instanceof Error
            ? error.message
            : "Staging-Dateien konnten nicht bereinigt werden.";
      }
      const row = Array.isArray(rpcData)
        ? (rpcData[0] as Record<string, unknown> | undefined)
        : undefined;
      return {
        ok: true as const,
        tableCount: Number(row?.table_count ?? backup.manifest.tableCount),
        totalRows: Number(row?.total_rows ?? backup.manifest.totalRows),
        documentsRestored: promoted.createdFinalPaths.length,
        cleanupWarning,
      };
    } catch (error) {
      if (promoted) {
        try {
          await cleanupRestoreStorage(supabaseAdmin, [
            ...promoted.createdFinalPaths,
            ...promoted.stagingPaths,
          ]);
        } catch (cleanupError) {
          const original = error instanceof Error ? error.message : String(error);
          const cleanup =
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
          throw new Error(
            `${original} Zusaetzlich ist die Restore-Dateibereinigung fehlgeschlagen: ${cleanup}`,
          );
        }
      }
      throw error;
    }
  });

export const cancelRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { planToken: string } => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Restore-Abbruch ist ungueltig.");
    }
    const planToken = (data as Record<string, unknown>).planToken;
    if (typeof planToken !== "string" || planToken.length === 0) {
      throw new Error("Restore-Plan fehlt.");
    }
    return { planToken };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { cleanupRestoreStorage, verifyRestorePlan } =
      await import("@/lib/backup-restore-storage.server");
    const plan = verifyRestorePlan(data.planToken);
    if (plan.userId !== context.userId) {
      throw new Error("Restore-Plan gehoert zu einem anderen Benutzer.");
    }
    const stagingPaths = plan.entries.flatMap((entry) =>
      entry.stagingPath ? [entry.stagingPath] : [],
    );
    await cleanupRestoreStorage(supabaseAdmin, stagingPaths);
    return { ok: true as const, removed: stagingPaths.length };
  });
