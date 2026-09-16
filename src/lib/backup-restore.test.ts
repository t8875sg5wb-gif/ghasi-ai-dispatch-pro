import { describe, expect, it } from "bun:test";

import { BACKUP_TABLES, type BackupData } from "@/lib/backup-tables";
import { createRestoreBackup, parseRestoreBackup } from "@/lib/backup-restore";
import { prepareBackupZip } from "@/lib/backup-zip";

function synthetischesBackup(): BackupData {
  const data = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as BackupData;
  data.orders = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      kilometer: 12.5,
      begleitperson: false,
      meta: { quelle: "synthetisch", flags: ["a", "b"] },
      optional: null,
    },
  ];
  return data;
}

function synthetischesRecoveryBackup(): BackupData {
  const data = synthetischesBackup();
  const userId = "11111111-1111-4111-8111-111111111111";
  data.user_roles = [{ id: "role-1", user_id: userId, role: "admin" }];
  data.profiles = [{ id: userId, name: "Test" }];
  data.documents = [
    { id: "doc-active", status: "active", storage_path: "2026/active.pdf" },
    { id: "doc-pending", status: "pending_delete", storage_path: "2026/pending.pdf" },
  ];
  return data;
}

describe("Restore-Dry-Run", () => {
  it("erhaelt Datentypen und alle Tabellen beim JSON-Roundtrip exakt", () => {
    const original = synthetischesBackup();
    const paket = createRestoreBackup(
      original,
      "snapshot-test",
      new Date("2026-09-10T10:00:00.000Z"),
    );
    const gelesen = parseRestoreBackup(JSON.stringify(paket));
    expect(gelesen.data).toEqual(original);
    expect(gelesen.manifest.tableCount).toBe(BACKUP_TABLES.length);
    expect(gelesen.manifest.totalRows).toBe(1);
    expect(gelesen.manifest.databaseSnapshotId).toBe("snapshot-test");
  });

  it("legt die maschinenlesbare Restore-Datei wirklich in die ZIP", async () => {
    const original = synthetischesBackup();
    const { zip, tables, rows } = prepareBackupZip(
      original,
      "snapshot-test",
      new Date("2026-09-10T10:00:00.000Z"),
    );
    const json = await zip.file("ghasi-backup.json")?.async("string");
    expect(json).toBeDefined();
    expect(parseRestoreBackup(json!).data).toEqual(original);
    expect(tables).toBe(BACKUP_TABLES.length);
    expect(rows).toBe(1);
  });

  it("erzeugt kein Restore-Backup ohne Snapshot-Nachweis", () => {
    expect(() => createRestoreBackup(synthetischesBackup(), " ")).toThrow("Snapshot-ID");
  });

  it("lehnt fehlende Tabellen fail-closed ab", () => {
    const paket = createRestoreBackup(synthetischesBackup(), "snapshot-test");
    delete (paket.data as Record<string, unknown>).documents;
    expect(() => parseRestoreBackup(JSON.stringify(paket))).toThrow("documents");
  });

  it("lehnt unbekannte Tabellen fail-closed ab", () => {
    const paket = createRestoreBackup(synthetischesBackup(), "snapshot-test");
    (paket.data as Record<string, unknown>).fremde_tabelle = [];
    expect(() => parseRestoreBackup(JSON.stringify(paket))).toThrow("unbekannte Tabellen");
  });

  it("lehnt eine nicht unterstuetzte Version ab", () => {
    const paket = createRestoreBackup(synthetischesBackup(), "snapshot-test");
    (paket.manifest as { version: number }).version = 99;
    expect(() => parseRestoreBackup(JSON.stringify(paket))).toThrow("Version");
  });

  it("erkennt manipulierte Zeilenzaehler", () => {
    const paket = createRestoreBackup(synthetischesBackup(), "snapshot-test");
    paket.manifest.rowCounts.orders = 999;
    expect(() => parseRestoreBackup(JSON.stringify(paket))).toThrow("orders");
  });

  it("leitet externe Recovery-Anforderungen aus den Daten ab", () => {
    const paket = createRestoreBackup(synthetischesRecoveryBackup(), "snapshot-test");
    expect(paket.manifest.recovery.authUserIds).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(paket.manifest.recovery.storageObjects).toEqual([
      { bucket: "documents", path: "2026/active.pdf" },
    ]);
  });

  it("lehnt unsichere aktive Dokumentpfade bereits im Backupformat ab", () => {
    const data = synthetischesRecoveryBackup();
    data.documents = [{ id: "doc-unsafe", status: "active", storage_path: "../escape.pdf" }];
    expect(() => createRestoreBackup(data, "snapshot-test")).toThrow("Unsicherer Dokumentpfad");
  });

  it("erkennt manipulierte Recovery-Anforderungen", () => {
    const paket = createRestoreBackup(synthetischesRecoveryBackup(), "snapshot-test");
    paket.manifest.recovery.authUserIds = [];
    expect(() => parseRestoreBackup(JSON.stringify(paket))).toThrow("Recovery-Anforderungen");
  });
});
