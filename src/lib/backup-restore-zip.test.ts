import { describe, expect, test } from "bun:test";
import JSZip from "jszip";

import { BACKUP_TABLES, type BackupData } from "@/lib/backup-tables";
import { addDocumentFilesToBackupZip } from "@/lib/backup-document-files";
import { createRestoreBackup } from "@/lib/backup-restore";
import { parseCompleteRestoreZip } from "@/lib/backup-restore-zip";

function data(): BackupData {
  const result = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as BackupData;
  result.documents = [
    { id: "doc-1", status: "active", storage_path: "synthetic/a.pdf" },
    { id: "doc-2", status: "active", storage_path: "synthetic/b.png" },
  ];
  return result;
}

async function validZip(): Promise<JSZip> {
  const zip = new JSZip();
  const backup = createRestoreBackup(data(), "restore-zip-test");
  zip.file("ghasi-backup.json", JSON.stringify(backup));
  await addDocumentFilesToBackupZip(zip, backup, [
    { path: "synthetic/a.pdf", bytes: new Uint8Array([1, 2, 3]) },
    { path: "synthetic/b.png", bytes: new Uint8Array([4, 5]) },
  ]);
  return zip;
}
describe("vollstaendiges Restore-ZIP", () => {
  test("akzeptiert nur Backup, Manifest und Dateien mit passenden Hashes", async () => {
    const bytes = await (await validZip()).generateAsync({ type: "uint8array" });
    const parsed = await parseCompleteRestoreZip(bytes);
    expect(parsed.backup.manifest.databaseSnapshotId).toBe("restore-zip-test");
    expect(parsed.documentManifest.map((entry) => entry.path)).toEqual([
      "synthetic/a.pdf",
      "synthetic/b.png",
    ]);
    expect(parsed.files.get("synthetic/a.pdf")).toEqual(new Uint8Array([1, 2, 3]));
  });

  test("blockiert manipulierte Dokumentbytes", async () => {
    const zip = await validZip();
    zip.file("documents/synthetic/a.pdf", new Uint8Array([9, 9, 9]));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await expect(parseCompleteRestoreZip(bytes)).rejects.toThrow("SHA-256");
  });

  test("blockiert unerwartete Dateien im Dokumentbereich", async () => {
    const zip = await validZip();
    zip.file("documents/synthetic/extra.pdf", new Uint8Array([1]));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await expect(parseCompleteRestoreZip(bytes)).rejects.toThrow("unerwartete Dokumentdateien");
  });
});
