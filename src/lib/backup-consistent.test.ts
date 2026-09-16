import { describe, expect, it } from "bun:test";

import { BACKUP_TABLES } from "@/lib/backup-tables";
import {
  collectConsistentBackupData,
  type ConsistentBackupClient,
  type SnapshotRow,
} from "@/lib/backup-consistent";

function snapshotRows(snapshotId = "10:20:"): SnapshotRow[] {
  return BACKUP_TABLES.map((table) => ({
    table_name: table,
    rows: [{ test_table: table }],
    row_count: 1,
    snapshot_id: snapshotId,
  }));
}

function clientFor(data: SnapshotRow[] | null, error?: string, calls: string[] = []) {
  return {
    rpc: (name: string) => {
      calls.push(name);
      return Promise.resolve({ data, error: error ? { message: error } : null });
    },
  } as ConsistentBackupClient;
}
describe("konsistenter Backup-Snapshot", () => {
  it("holt alle Tabellen mit genau einem RPC-Aufruf", async () => {
    const calls: string[] = [];
    const { result, snapshotId } = await collectConsistentBackupData(
      clientFor(snapshotRows(), undefined, calls),
    );

    expect(calls).toEqual(["ghasi_backup_snapshot"]);
    expect(Object.keys(result)).toHaveLength(BACKUP_TABLES.length);
    expect(result.orders?.[0]).toEqual({ test_table: "orders" });
    expect(snapshotId).toBe("10:20:");
  });

  it("lehnt fehlende oder doppelte Tabellen ab", async () => {
    const missing = snapshotRows().slice(1);
    await expect(collectConsistentBackupData(clientFor(missing))).rejects.toThrow(
      "Backup-Snapshot unvollstaendig",
    );

    const duplicate = [...snapshotRows(), snapshotRows()[0]!];
    await expect(collectConsistentBackupData(clientFor(duplicate))).rejects.toThrow(
      "Backup-Snapshot enthaelt doppelte Tabellen",
    );
  });

  it("lehnt widerspruechliche Snapshot- und Zeilenangaben ab", async () => {
    const mixed = snapshotRows();
    mixed[1] = { ...mixed[1]!, snapshot_id: "11:21:" };
    await expect(collectConsistentBackupData(clientFor(mixed))).rejects.toThrow(
      "Backup-Snapshot-IDs stimmen nicht ueberein",
    );

    const badCount = snapshotRows();
    badCount[2] = { ...badCount[2]!, row_count: 99 };
    await expect(collectConsistentBackupData(clientFor(badCount))).rejects.toThrow("Zeilenzaehler");
  });

  it("reicht RPC-Fehler fail-closed weiter", async () => {
    await expect(
      collectConsistentBackupData(clientFor(null, "database unavailable")),
    ).rejects.toThrow("database unavailable");
  });
});
