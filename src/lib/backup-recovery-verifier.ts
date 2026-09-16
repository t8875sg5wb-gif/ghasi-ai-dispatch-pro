import type { RestoreBackup } from "@/lib/backup-restore";
import { assertSafeRecoveryStoragePath, parseRestoreBackup } from "@/lib/backup-restore";

export interface RecoveryExistenceProbe {
  authUserExists: (userId: string) => Promise<boolean>;
  storageObjectExists: (bucket: "documents", path: string) => Promise<boolean>;
}

function verificationFailure(kind: string, id: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : "unbekannter Fehler";
  return new Error(`Recovery-Pruefung fehlgeschlagen (${kind}: ${id}): ${detail}`);
}

export async function verifyRecoveryPrerequisites(
  candidate: RestoreBackup,
  probe: RecoveryExistenceProbe,
): Promise<void> {
  const backup = parseRestoreBackup(JSON.stringify(candidate));

  for (const userId of backup.manifest.recovery.authUserIds) {
    let exists: boolean;
    try {
      exists = await probe.authUserExists(userId);
    } catch (error) {
      throw verificationFailure("Auth", userId, error);
    }
    if (!exists) {
      throw new Error(`Restore abgebrochen: Auth-Benutzer fehlt: ${userId}.`);
    }
  }

  for (const object of backup.manifest.recovery.storageObjects) {
    assertSafeRecoveryStoragePath(object.path);
    let exists: boolean;
    try {
      exists = await probe.storageObjectExists(object.bucket, object.path);
    } catch (error) {
      throw verificationFailure("Storage", `${object.bucket}/${object.path}`, error);
    }
    if (!exists) {
      throw new Error(
        `Restore abgebrochen: Storage-Objekt fehlt: ${object.bucket}/${object.path}.`,
      );
    }
  }
}
