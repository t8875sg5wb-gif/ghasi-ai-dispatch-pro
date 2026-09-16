import type { BackupDocumentFileManifestEntry } from "@/lib/backup-document-files";
import type { RestoreUploadInstruction } from "@/lib/backup-restore-storage.server";

export interface RestoreUploadBucket {
  uploadToSignedUrl(
    path: string,
    token: string,
    data: Uint8Array,
    options?: { upsert?: boolean; contentType?: string },
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface RestoreUploadClient {
  storage: { from(bucket: "documents"): RestoreUploadBucket };
}

export interface RestoreUploadProgress {
  completed: number;
  total: number;
  currentPath: string;
}

export async function uploadRestoreStagingFiles(
  files: ReadonlyMap<string, Uint8Array>,
  uploads: readonly RestoreUploadInstruction[],
  client: RestoreUploadClient,
  onProgress?: (progress: RestoreUploadProgress) => void,
): Promise<void> {
  const bucket = client.storage.from("documents");
  for (let index = 0; index < uploads.length; index += 1) {
    const upload = uploads[index]!;
    const bytes = files.get(upload.finalPath);
    if (!bytes) throw new Error(`Restore-Datei fehlt lokal: ${upload.finalPath}.`);
    if (bytes.byteLength !== upload.size) {
      throw new Error(`Restore-Datei hat lokal die falsche Groesse: ${upload.finalPath}.`);
    }
    onProgress?.({
      completed: index,
      total: uploads.length,
      currentPath: upload.finalPath,
    });
    const { error } = await bucket.uploadToSignedUrl(upload.stagingPath, upload.token, bytes, {
      upsert: false,
      contentType: "application/octet-stream",
    });
    if (error) {
      throw new Error(`Restore-Upload fehlgeschlagen (${upload.finalPath}): ${error.message}`);
    }
    onProgress?.({
      completed: index + 1,
      total: uploads.length,
      currentPath: upload.finalPath,
    });
  }
}

export function documentManifestByPath(
  manifest: readonly BackupDocumentFileManifestEntry[],
): Map<string, BackupDocumentFileManifestEntry> {
  return new Map(manifest.map((entry) => [entry.path, entry]));
}
