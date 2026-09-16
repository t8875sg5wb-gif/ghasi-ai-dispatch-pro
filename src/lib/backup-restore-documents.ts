import type { BackupDocumentFileManifestEntry } from "@/lib/backup-document-files";
import { assertSafeRecoveryStoragePath, type RestoreBackup } from "@/lib/backup-restore";

export function validateRestoreDocumentManifest(
  backup: RestoreBackup,
  value: unknown,
): BackupDocumentFileManifestEntry[] {
  if (!Array.isArray(value)) throw new Error("Dokumentdatei-Manifest fehlt oder ist ungueltig.");
  const seen = new Set<string>();
  const entries = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Dokumentdatei-Manifest enthaelt einen ungueltigen Eintrag.");
    }
    const entry = item as Record<string, unknown>;
    const path = entry.path;
    const size = entry.size;
    const sha256 = entry.sha256;
    if (typeof path !== "string")
      throw new Error("Dokumentdatei-Manifest enthaelt keinen gueltigen Pfad.");
    assertSafeRecoveryStoragePath(path);
    if (seen.has(path)) throw new Error(`Dokumentdatei-Manifest enthaelt doppelten Pfad: ${path}.`);
    seen.add(path);
    if (!Number.isSafeInteger(size) || (size as number) < 0) {
      throw new Error(`Dokumentdatei-Manifest enthaelt ungueltige Groesse fuer ${path}.`);
    }
    if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) {
      throw new Error(`Dokumentdatei-Manifest enthaelt ungueltigen SHA-256 fuer ${path}.`);
    }
    return { path, size: size as number, sha256 };
  });

  const expected = backup.manifest.recovery.storageObjects.map((item) => item.path).sort();
  const actual = entries.map((entry) => entry.path).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Dokumentdatei-Manifest stimmt nicht mit den Recovery-Anforderungen ueberein.");
  }
  return entries;
}
