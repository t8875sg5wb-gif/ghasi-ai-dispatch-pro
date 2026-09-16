import JSZip from "jszip";

import type { BackupDocumentFileManifestEntry } from "@/lib/backup-document-files";
import { parseRestoreBackup, type RestoreBackup } from "@/lib/backup-restore";
import { validateRestoreDocumentManifest } from "@/lib/backup-restore-documents";

export interface ParsedRestoreZip {
  backup: RestoreBackup;
  documentManifest: BackupDocumentFileManifestEntry[];
  files: Map<string, Uint8Array>;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function parseCompleteRestoreZip(
  input: Blob | ArrayBuffer | Uint8Array,
): Promise<ParsedRestoreZip> {
  const zip = await JSZip.loadAsync(input);
  const backupFile = zip.file("ghasi-backup.json");
  const manifestFile = zip.file("ghasi-document-files.json");
  if (!backupFile) throw new Error("Backup-ZIP enthaelt keine ghasi-backup.json.");
  if (!manifestFile) throw new Error("Backup-ZIP enthaelt kein Dokumentdatei-Manifest.");

  const backup = parseRestoreBackup(await backupFile.async("string"));
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(await manifestFile.async("string"));
  } catch {
    throw new Error("Dokumentdatei-Manifest ist kein gueltiges JSON.");
  }
  const documentManifest = validateRestoreDocumentManifest(backup, rawManifest);
  const allowedEntries = new Set(documentManifest.map((entry) => `documents/${entry.path}`));
  const unexpected = Object.keys(zip.files).filter(
    (name) => name.startsWith("documents/") && !zip.files[name]!.dir && !allowedEntries.has(name),
  );
  if (unexpected.length > 0) {
    throw new Error(`Backup-ZIP enthaelt unerwartete Dokumentdateien: ${unexpected.join(", ")}.`);
  }
  const files = new Map<string, Uint8Array>();
  for (const entry of documentManifest) {
    const zipEntry = zip.file(`documents/${entry.path}`);
    if (!zipEntry) throw new Error(`Backup-ZIP enthaelt die Dokumentdatei nicht: ${entry.path}.`);
    const bytes = await zipEntry.async("uint8array");
    if (bytes.byteLength !== entry.size) {
      throw new Error(`Dokumentdatei ${entry.path} hat nicht die erwartete Groesse.`);
    }
    const actualHash = await sha256Hex(bytes);
    if (actualHash !== entry.sha256) {
      throw new Error(
        `Dokumentdatei ${entry.path} stimmt nicht mit dem SHA-256-Manifest ueberein.`,
      );
    }
    files.set(entry.path, bytes);
  }

  return { backup, documentManifest, files };
}
