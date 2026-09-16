// Client-side helper: turns the raw backup JSON (from exportAllData) into a
// ZIP archive containing one CSV per domain table, then triggers a download.
import JSZip from "jszip";

import { toCsv } from "@/lib/export-utils";
import type { BackupData } from "@/lib/backup-tables";
import { createRestoreBackup } from "@/lib/backup-restore";
import {
  addDocumentFilesToBackupZip,
  downloadBackupDocumentFiles,
  type BackupDocumentDownloadSource,
} from "@/lib/backup-document-files";

export function prepareBackupZip(
  data: BackupData,
  databaseSnapshotId: string,
  createdAt = new Date(),
) {
  const zip = new JSZip();
  let totalRows = 0;
  let tableCount = 0;

  const restoreBackup = createRestoreBackup(data, databaseSnapshotId, createdAt);
  zip.file("ghasi-backup.json", JSON.stringify(restoreBackup, null, 2));

  for (const [table, rows] of Object.entries(data)) {
    tableCount += 1;
    totalRows += rows.length;
    // Flatten nested objects to JSON strings so every cell is CSV-safe.
    const flatRows = rows.map((row) => {
      const flat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        flat[k] = v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      }
      return flat;
    });
    const csv = toCsv(flatRows);
    // Prefix with BOM so Excel opens UTF-8 correctly.
    zip.file(`${table}.csv`, `\uFEFF${csv}`);
  }

  return { zip, tables: tableCount, rows: totalRows, restoreBackup };
}

export async function prepareCompleteBackupZip(
  data: BackupData,
  databaseSnapshotId: string,
  documentSources: readonly BackupDocumentDownloadSource[],
  createdAt = new Date(),
  fetcher: typeof fetch = fetch,
) {
  const prepared = prepareBackupZip(data, databaseSnapshotId, createdAt);
  const documentFiles = await downloadBackupDocumentFiles(documentSources, fetcher);
  await addDocumentFilesToBackupZip(prepared.zip, prepared.restoreBackup, documentFiles);
  return prepared;
}

/** Build a ZIP of database data and every active document file, then trigger a download. */
export async function downloadBackupZip(
  data: BackupData,
  databaseSnapshotId: string,
  documentSources: readonly BackupDocumentDownloadSource[],
): Promise<{ tables: number; rows: number }> {
  const createdAt = new Date();
  const { zip, tables, rows } = await prepareCompleteBackupZip(
    data,
    databaseSnapshotId,
    documentSources,
    createdAt,
  );
  const stamp = createdAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ghasi-backup-${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { tables, rows };
}
