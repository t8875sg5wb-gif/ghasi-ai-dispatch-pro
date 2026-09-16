import { describe, expect, it } from "bun:test";

import { BACKUP_TABLES, type BackupData } from "@/lib/backup-tables";
import { createRestoreBackup } from "@/lib/backup-restore";
import {
  verifyRecoveryPrerequisites,
  type RecoveryExistenceProbe,
} from "@/lib/backup-recovery-verifier";

function recoveryBackup() {
  const data = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as BackupData;
  const userId = "11111111-1111-4111-8111-111111111111";
  data.profiles = [{ id: userId, name: "Synthetic" }];
  data.documents = [
    { id: "doc-1", status: "active", storage_path: "2026/synthetic.pdf" },
    { id: "doc-2", status: "pending_delete", storage_path: "2026/old.pdf" },
  ];
  return createRestoreBackup(data, "snapshot-synthetic");
}

function probe(overrides: Partial<RecoveryExistenceProbe> = {}): RecoveryExistenceProbe {
  return {
    authUserExists: async () => true,
    storageObjectExists: async () => true,
    ...overrides,
  };
}
describe("trusted recovery prerequisite verification", () => {
  it("verifies required auth users and active storage objects independently", async () => {
    const authCalls: string[] = [];
    const storageCalls: string[] = [];
    await expect(
      verifyRecoveryPrerequisites(
        recoveryBackup(),
        probe({
          authUserExists: async (id) => {
            authCalls.push(id);
            return true;
          },
          storageObjectExists: async (_bucket, path) => {
            storageCalls.push(path);
            return true;
          },
        }),
      ),
    ).resolves.toBeUndefined();
    expect(authCalls).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(storageCalls).toEqual(["2026/synthetic.pdf"]);
  });

  it("blocks when a required auth user is missing", async () => {
    await expect(
      verifyRecoveryPrerequisites(recoveryBackup(), probe({ authUserExists: async () => false })),
    ).rejects.toThrow("Auth-Benutzer");
  });

  it("blocks when a required document object is missing", async () => {
    await expect(
      verifyRecoveryPrerequisites(
        recoveryBackup(),
        probe({ storageObjectExists: async () => false }),
      ),
    ).rejects.toThrow("Storage-Objekt");
  });

  it("fails closed when an external verification service errors", async () => {
    await expect(
      verifyRecoveryPrerequisites(
        recoveryBackup(),
        probe({
          authUserExists: async () => {
            throw new Error("service unavailable");
          },
        }),
      ),
    ).rejects.toThrow("Pruefung fehlgeschlagen");
  });
});
