import { BACKUP_TABLES, type BackupData } from "@/lib/backup-tables";

export const BACKUP_FORMAT = "ghasi-backup" as const;
export const BACKUP_FORMAT_VERSION = 3 as const;

export const AUTH_USER_REFERENCES = [
  { table: "activity_log", column: "user_id" },
  { table: "ai_audit_log", column: "user_id" },
  { table: "drivers", column: "user_id" },
  { table: "ghasi_memory", column: "user_id" },
  { table: "orders", column: "fahrer_user_id" },
  { table: "profiles", column: "id" },
  { table: "recurring_rejections", column: "user_id" },
  { table: "user_roles", column: "user_id" },
] as const;

export interface RecoveryStorageObject {
  bucket: "documents";
  path: string;
}

export interface BackupRecoveryRequirements {
  authUserIds: string[];
  storageObjects: RecoveryStorageObject[];
}
export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_FORMAT_VERSION;
  createdAt: string;
  databaseSnapshotId: string;
  tableCount: number;
  totalRows: number;
  rowCounts: Record<string, number>;
  recovery: BackupRecoveryRequirements;
}

export interface RestoreBackup {
  manifest: BackupManifest;
  data: BackupData;
}

function istDatensatz(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function assertSafeRecoveryStoragePath(path: string): void {
  if (!path || path.startsWith("/") || path.includes("\\") || path.includes("\0")) {
    throw new Error(`Unsicherer Dokumentpfad im Backup: ${path || "(leer)"}.`);
  }
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`Unsicherer Dokumentpfad im Backup: ${path}.`);
  }
}
export function validateBackupData(value: unknown): BackupData {
  if (!istDatensatz(value)) throw new Error("Backup-Daten haben kein gueltiges Objektformat.");

  const expected = new Set<string>(BACKUP_TABLES);
  const actual = Object.keys(value);
  const missing = BACKUP_TABLES.filter((table) => !(table in value));
  const unknown = actual.filter((table) => !expected.has(table));
  if (missing.length > 0)
    throw new Error(`Backup unvollstaendig: ${missing.join(", ")} fehlt/fehlen.`);
  if (unknown.length > 0)
    throw new Error(`Backup enthaelt unbekannte Tabellen: ${unknown.join(", ")}.`);

  for (const table of BACKUP_TABLES) {
    const rows = value[table];
    if (!Array.isArray(rows) || rows.some((row) => !istDatensatz(row))) {
      throw new Error(`Backup-Tabelle ${table} hat ein ungueltiges Zeilenformat.`);
    }
  }
  return value as BackupData;
}

function authUserIdsAusDaten(data: BackupData): string[] {
  const ids: string[] = [];
  for (const ref of AUTH_USER_REFERENCES) {
    for (const row of data[ref.table] ?? []) {
      const value = row[ref.column];
      if (value === null || value === undefined) continue;
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(
          `Backup enthaelt ungueltige Auth-Benutzer-ID in ${ref.table}.${ref.column}.`,
        );
      }
      ids.push(value);
    }
  }
  return sortedUnique(ids);
}
function storageObjekteAusDaten(data: BackupData): RecoveryStorageObject[] {
  const paths: string[] = [];
  for (const row of data.documents ?? []) {
    if (row.status !== "active") continue;
    const path = row.storage_path;
    if (typeof path !== "string" || path.length === 0) {
      throw new Error("Aktives Dokument hat keinen gueltigen Storage-Pfad.");
    }
    assertSafeRecoveryStoragePath(path);
    paths.push(path);
  }
  return sortedUnique(paths).map((path) => ({ bucket: "documents", path }));
}

export function deriveRecoveryRequirements(data: BackupData): BackupRecoveryRequirements {
  return {
    authUserIds: authUserIdsAusDaten(data),
    storageObjects: storageObjekteAusDaten(data),
  };
}

function recoveryGleich(a: BackupRecoveryRequirements, b: BackupRecoveryRequirements): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function parseRecoveryRequirements(value: unknown): BackupRecoveryRequirements {
  if (
    !istDatensatz(value) ||
    !Array.isArray(value.authUserIds) ||
    !Array.isArray(value.storageObjects)
  ) {
    throw new Error("Backup-Recovery-Anforderungen fehlen oder sind ungueltig.");
  }
  if (value.authUserIds.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new Error("Backup-Recovery-Anforderungen enthalten ungueltige Auth-Benutzer-IDs.");
  }
  const storageObjects: RecoveryStorageObject[] = [];
  for (const item of value.storageObjects) {
    if (
      !istDatensatz(item) ||
      item.bucket !== "documents" ||
      typeof item.path !== "string" ||
      item.path.length === 0
    ) {
      throw new Error("Backup-Recovery-Anforderungen enthalten ungueltige Storage-Objekte.");
    }
    storageObjects.push({ bucket: "documents", path: item.path });
  }
  return { authUserIds: [...value.authUserIds] as string[], storageObjects };
}

export function createRestoreBackup(
  data: BackupData,
  databaseSnapshotId: string,
  createdAt = new Date(),
): RestoreBackup {
  if (typeof databaseSnapshotId !== "string" || databaseSnapshotId.trim().length === 0) {
    throw new Error("Backup-Snapshot-ID fehlt.");
  }
  const valid = validateBackupData(data);
  const rowCounts = Object.fromEntries(BACKUP_TABLES.map((table) => [table, valid[table]!.length]));
  const totalRows = Object.values(rowCounts).reduce((sum, count) => sum + count, 0);
  return {
    manifest: {
      format: BACKUP_FORMAT,
      version: BACKUP_FORMAT_VERSION,
      createdAt: createdAt.toISOString(),
      databaseSnapshotId,
      tableCount: BACKUP_TABLES.length,
      totalRows,
      rowCounts,
      recovery: deriveRecoveryRequirements(valid),
    },
    data: valid,
  };
}

export function parseRestoreBackup(json: string): RestoreBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Backup-Datei ist kein gueltiges JSON.");
  }
  if (!istDatensatz(parsed) || !istDatensatz(parsed.manifest)) {
    throw new Error("Backup-Datei hat kein gueltiges GHASI-Format.");
  }
  const manifest = parsed.manifest;
  if (manifest.format !== BACKUP_FORMAT || manifest.version !== BACKUP_FORMAT_VERSION) {
    throw new Error("Backup-Format oder Version wird von dieser GHASI-Version nicht unterstuetzt.");
  }
  const data = validateBackupData(parsed.data);
  if (
    typeof manifest.databaseSnapshotId !== "string" ||
    manifest.databaseSnapshotId.trim().length === 0
  ) {
    throw new Error("Backup-Snapshot-ID fehlt oder ist ungueltig.");
  }
  if (manifest.tableCount !== BACKUP_TABLES.length) {
    throw new Error("Backup-Tabellenzahl stimmt nicht.");
  }
  if (!istDatensatz(manifest.rowCounts)) {
    throw new Error("Backup-Zeilenzaehler fehlen.");
  }
  for (const table of BACKUP_TABLES) {
    if (manifest.rowCounts[table] !== data[table]!.length) {
      throw new Error(`Backup-Zeilenzaehler fuer ${table} stimmt nicht.`);
    }
  }
  const totalRows = BACKUP_TABLES.reduce((sum, table) => sum + data[table]!.length, 0);
  if (manifest.totalRows !== totalRows) {
    throw new Error("Backup-Gesamtzeilenzahl stimmt nicht.");
  }

  const recovery = parseRecoveryRequirements(manifest.recovery);
  const expectedRecovery = deriveRecoveryRequirements(data);
  if (!recoveryGleich(recovery, expectedRecovery)) {
    throw new Error("Backup-Recovery-Anforderungen stimmen nicht mit den Backupdaten ueberein.");
  }

  return {
    manifest: { ...(manifest as unknown as BackupManifest), recovery },
    data,
  };
}
