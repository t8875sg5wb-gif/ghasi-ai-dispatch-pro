import { describe, expect, it } from "bun:test";
import JSZip from "jszip";

import { BACKUP_TABLES, type BackupData } from "@/lib/backup-tables";
import { addDocumentFilesToBackupZip } from "@/lib/backup-document-files";
import { createRestoreBackup } from "@/lib/backup-restore";

function backup() {
  const data = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as BackupData;
  data.documents = [
    { id: "doc-a", status: "active", storage_path: "synthetic/a.pdf" },
    { id: "doc-b", status: "active", storage_path: "synthetic/b.png" },
    { id: "doc-old", status: "pending_delete", storage_path: "synthetic/old.pdf" },
  ];
  return createRestoreBackup(data, "synthetic-document-snapshot");
}

describe("Dokumentdatei-Backup", () => {
  it("legt alle aktiven Dateien samt SHA-256-Manifest in die ZIP", async () => {
    const zip = new JSZip();
    const manifest = await addDocumentFilesToBackupZip(zip, backup(), [
      { path: "synthetic/b.png", bytes: new Uint8Array([4, 5]) },
      { path: "synthetic/a.pdf", bytes: new Uint8Array([1, 2, 3]) },
    ]);

    expect(manifest.map((item) => item.path)).toEqual(["synthetic/a.pdf", "synthetic/b.png"]);
    expect(manifest.map((item) => item.size)).toEqual([3, 2]);
    expect(manifest.every((item) => /^[0-9a-f]{64}$/.test(item.sha256))).toBe(true);
    expect(await zip.file("documents/synthetic/a.pdf")?.async("uint8array")).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(await zip.file("documents/synthetic/b.png")?.async("uint8array")).toEqual(
      new Uint8Array([4, 5]),
    );
    const json = await zip.file("ghasi-document-files.json")?.async("string");
    expect(JSON.parse(json!)).toEqual(manifest);
    expect(zip.file("documents/synthetic/old.pdf")).toBeNull();
  });

  it("blockiert fehlende, unerwartete und doppelte Dokumentdateien", async () => {
    await expect(
      addDocumentFilesToBackupZip(new JSZip(), backup(), [
        { path: "synthetic/a.pdf", bytes: new Uint8Array([1]) },
      ]),
    ).rejects.toThrow("unvollstaendig");

    await expect(
      addDocumentFilesToBackupZip(new JSZip(), backup(), [
        { path: "synthetic/a.pdf", bytes: new Uint8Array([1]) },
        { path: "synthetic/b.png", bytes: new Uint8Array([2]) },
        { path: "synthetic/extra.pdf", bytes: new Uint8Array([3]) },
      ]),
    ).rejects.toThrow("unerwartete Dateien");

    await expect(
      addDocumentFilesToBackupZip(new JSZip(), backup(), [
        { path: "synthetic/a.pdf", bytes: new Uint8Array([1]) },
        { path: "synthetic/a.pdf", bytes: new Uint8Array([2]) },
      ]),
    ).rejects.toThrow("doppelt geliefert");
  });
});
