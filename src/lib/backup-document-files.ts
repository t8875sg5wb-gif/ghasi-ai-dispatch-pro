import type JSZip from "jszip";

import type { RestoreBackup } from "@/lib/backup-restore";

export interface BackupDocumentFile {
  path: string;
  bytes: Uint8Array;
}

export interface BackupDocumentFileManifestEntry {
  path: string;
  size: number;
  sha256: string;
}

export interface BackupDocumentDownloadSource {
  path: string;
  signedUrl: string;
}

export async function downloadBackupDocumentFiles(
  sources: readonly BackupDocumentDownloadSource[],
  fetcher: typeof fetch = fetch,
): Promise<BackupDocumentFile[]> {
  const seen = new Set<string>();
  const files: BackupDocumentFile[] = [];
  for (const source of sources) {
    if (seen.has(source.path))
      throw new Error(`Dokumentdatei doppelt bereitgestellt: ${source.path}.`);
    seen.add(source.path);
    const response = await fetcher(source.signedUrl, { credentials: "omit" });
    if (!response.ok)
      throw new Error(`Dokumentdatei konnte nicht fuer das Backup geladen werden: ${source.path}.`);
    files.push({ path: source.path, bytes: new Uint8Array(await response.arrayBuffer()) });
  }
  return files;
}

function requiredPaths(backup: RestoreBackup): string[] {
  return backup.manifest.recovery.storageObjects.map((item) => item.path).sort();
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
export async function addDocumentFilesToBackupZip(
  zip: JSZip,
  backup: RestoreBackup,
  files: readonly BackupDocumentFile[],
): Promise<BackupDocumentFileManifestEntry[]> {
  const required = requiredPaths(backup);
  const byPath = new Map<string, Uint8Array>();
  for (const file of files) {
    if (byPath.has(file.path)) throw new Error(`Dokumentdatei doppelt geliefert: ${file.path}.`);
    byPath.set(file.path, file.bytes);
  }

  const missing = required.filter((path) => !byPath.has(path));
  const unexpected = [...byPath.keys()].filter((path) => !required.includes(path)).sort();
  if (missing.length > 0) {
    throw new Error(`Dokumentdatei-Backup unvollstaendig: ${missing.join(", ")} fehlt/fehlen.`);
  }
  if (unexpected.length > 0) {
    throw new Error(`Dokumentdatei-Backup enthaelt unerwartete Dateien: ${unexpected.join(", ")}.`);
  }

  const manifest: BackupDocumentFileManifestEntry[] = [];
  for (const path of required) {
    const bytes = byPath.get(path)!;
    const entry = { path, size: bytes.byteLength, sha256: await sha256Hex(bytes) };
    manifest.push(entry);
    zip.file(`documents/${path}`, bytes);
  }
  zip.file("ghasi-document-files.json", JSON.stringify(manifest, null, 2));
  return manifest;
}
