import { BACKUP_TABLES, type BackupData } from "@/lib/backup-tables";

export const BACKUP_SNAPSHOT_RPC = "ghasi_backup_snapshot" as const;

export type SnapshotRow = {
  table_name: string;
  rows: Record<string, unknown>[];
  row_count: number;
  snapshot_id: string;
};

type SnapshotRpcResult = {
  data: SnapshotRow[] | null;
  error: { message: string } | null;
};

export type ConsistentBackupClient = {
  rpc: (name: typeof BACKUP_SNAPSHOT_RPC) => PromiseLike<SnapshotRpcResult>;
};

function fail(message: string): never {
  throw new Error(message);
}

export async function collectConsistentBackupData(
  client: ConsistentBackupClient,
): Promise<{ result: BackupData; snapshotId: string }> {
  const { data, error } = await client.rpc(BACKUP_SNAPSHOT_RPC);
  if (error) fail(`Backup-Snapshot fehlgeschlagen: ${error.message}`);
  if (!Array.isArray(data)) fail("Backup-Snapshot hat kein gueltiges Ergebnisformat.");

  const expected = new Set<string>(BACKUP_TABLES);
  const seen = new Set<string>();
  const result: BackupData = {};
  let snapshotId: string | null = null;

  for (const entry of data) {
    if (!entry || typeof entry.table_name !== "string" || !expected.has(entry.table_name)) {
      fail("Backup-Snapshot enthaelt eine unbekannte Tabelle.");
    }
    if (seen.has(entry.table_name)) {
      fail("Backup-Snapshot enthaelt doppelte Tabellen.");
    }
    seen.add(entry.table_name);
    if (!Array.isArray(entry.rows)) {
      fail(`Backup-Snapshot-Tabelle ${entry.table_name} hat kein gueltiges Zeilenformat.`);
    }
    if (entry.rows.some((row) => typeof row !== "object" || row === null || Array.isArray(row))) {
      fail(`Backup-Snapshot-Tabelle ${entry.table_name} enthaelt ungueltige Zeilen.`);
    }
    if (!Number.isInteger(entry.row_count) || entry.row_count !== entry.rows.length) {
      fail(`Backup-Snapshot-Zeilenzaehler fuer ${entry.table_name} stimmt nicht.`);
    }
    if (typeof entry.snapshot_id !== "string" || entry.snapshot_id.length === 0) {
      fail("Backup-Snapshot-ID fehlt.");
    }
    if (snapshotId === null) snapshotId = entry.snapshot_id;
    if (snapshotId !== entry.snapshot_id) {
      fail("Backup-Snapshot-IDs stimmen nicht ueberein.");
    }
    result[entry.table_name] = entry.rows;
  }

  const missing = BACKUP_TABLES.filter((table) => !seen.has(table));
  if (missing.length > 0) {
    fail(`Backup-Snapshot unvollstaendig: ${missing.join(", ")} fehlt/fehlen.`);
  }
  if (data.length !== BACKUP_TABLES.length || snapshotId === null) {
    fail("Backup-Snapshot unvollstaendig.");
  }

  return { result, snapshotId };
}
