import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { BackupDocumentFileManifestEntry } from "@/lib/backup-document-files";
import { validateRestoreDocumentManifest } from "@/lib/backup-restore-documents";
import type { RestoreBackup } from "@/lib/backup-restore";

export interface RestoreStorageBucket {
  exists(path: string): PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
  download(path: string): PromiseLike<{ data: Blob | null; error: { message: string } | null }>;
  createSignedUploadUrl(
    path: string,
    options?: { upsert?: boolean },
  ): PromiseLike<{ data: { token: string } | null; error: { message: string } | null }>;
  copy(
    fromPath: string,
    toPath: string,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  remove(paths: string[]): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface RestoreStorageClient {
  storage: { from(bucket: "documents"): RestoreStorageBucket };
}

export interface RestorePlanEntry extends BackupDocumentFileManifestEntry {
  stagingPath: string | null;
}
export interface RestorePlanPayload {
  version: 1;
  userId: string;
  expiresAt: number;
  snapshotId: string;
  backupDigest: string;
  manifestDigest: string;
  entries: RestorePlanEntry[];
}

export interface RestoreUploadInstruction {
  finalPath: string;
  stagingPath: string;
  token: string;
  size: number;
  sha256: string;
}

export interface PreparedRestoreStoragePlan {
  planToken: string;
  uploads: RestoreUploadInstruction[];
  alreadyPresent: number;
  expiresAt: number;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function signingKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt fuer den Restore-Plan.");
  return key;
}

export function signRestorePlan(payload: RestorePlanPayload, key = signingKey()): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyRestorePlan(token: string, key = signingKey()): RestorePlanPayload {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) throw new Error("Restore-Plan ist ungueltig.");
  const expected = createHmac("sha256", key).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Restore-Plan-Signatur ist ungueltig.");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as RestorePlanPayload;
  if (payload.version !== 1 || !Array.isArray(payload.entries))
    throw new Error("Restore-Plan-Version ist ungueltig.");
  return payload;
}
async function objectExists(bucket: RestoreStorageBucket, path: string): Promise<boolean> {
  const { data, error } = await bucket.exists(path);
  if (data === false) return false;
  if (error) throw new Error(`Storage-Pruefung fehlgeschlagen (${path}): ${error.message}`);
  return data === true;
}

async function readAndVerify(
  bucket: RestoreStorageBucket,
  path: string,
  expected: Pick<BackupDocumentFileManifestEntry, "size" | "sha256">,
): Promise<void> {
  const { data, error } = await bucket.download(path);
  if (error || !data)
    throw new Error(
      `Dokumentdatei konnte nicht gelesen werden (${path}): ${error?.message ?? "leer"}.`,
    );
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength !== expected.size)
    throw new Error(`Dokumentdatei hat falsche Groesse: ${path}.`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== expected.sha256) throw new Error(`Dokumentdatei hat falschen SHA-256: ${path}.`);
}

function assertPlanMatchesInput(
  plan: RestorePlanPayload,
  backup: RestoreBackup,
  manifest: BackupDocumentFileManifestEntry[],
  userId: string,
): void {
  if (plan.userId !== userId) throw new Error("Restore-Plan gehoert zu einem anderen Benutzer.");
  if (Date.now() > plan.expiresAt) throw new Error("Restore-Plan ist abgelaufen.");
  if (plan.snapshotId !== backup.manifest.databaseSnapshotId)
    throw new Error("Restore-Plan passt nicht zum Backup-Snapshot.");
  if (plan.backupDigest !== digest(backup))
    throw new Error("Restore-Plan passt nicht zu den Backup-Daten.");
  if (plan.manifestDigest !== digest(manifest))
    throw new Error("Restore-Plan passt nicht zum Dokumentmanifest.");
}
export async function prepareRestoreStoragePlan(
  backup: RestoreBackup,
  manifestValue: unknown,
  userId: string,
  client: RestoreStorageClient,
  key = signingKey(),
): Promise<PreparedRestoreStoragePlan> {
  const manifest = [...validateRestoreDocumentManifest(backup, manifestValue)].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  const bucket = client.storage.from("documents");
  const planId = randomUUID();
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const entries: RestorePlanEntry[] = [];
  const uploads: RestoreUploadInstruction[] = [];
  let alreadyPresent = 0;

  for (const [index, entry] of manifest.entries()) {
    if (await objectExists(bucket, entry.path)) {
      await readAndVerify(bucket, entry.path, entry);
      entries.push({ ...entry, stagingPath: null });
      alreadyPresent += 1;
      continue;
    }
    const stagingPath = `_restore_staging/${userId}/${planId}/${String(index).padStart(5, "0")}`;
    const { data, error } = await bucket.createSignedUploadUrl(stagingPath, { upsert: false });
    if (error || !data?.token)
      throw new Error(
        `Upload-Freigabe fuer ${entry.path} fehlgeschlagen: ${error?.message ?? "kein Token"}.`,
      );
    entries.push({ ...entry, stagingPath });
    uploads.push({
      finalPath: entry.path,
      stagingPath,
      token: data.token,
      size: entry.size,
      sha256: entry.sha256,
    });
  }
  const payload: RestorePlanPayload = {
    version: 1,
    userId,
    expiresAt,
    snapshotId: backup.manifest.databaseSnapshotId,
    backupDigest: digest(backup),
    manifestDigest: digest(manifest),
    entries,
  };
  return {
    planToken: signRestorePlan(payload, key),
    uploads,
    alreadyPresent,
    expiresAt,
  };
}

async function cleanupPaths(bucket: RestoreStorageBucket, paths: string[]): Promise<void> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return;
  const { error } = await bucket.remove(unique);
  if (error) throw new Error(`Restore-Dateibereinigung fehlgeschlagen: ${error.message}`);
}
export interface PromotedRestoreStorage {
  createdFinalPaths: string[];
  stagingPaths: string[];
}

export async function verifyAndPromoteRestoreStorage(
  planToken: string,
  backup: RestoreBackup,
  manifestValue: unknown,
  userId: string,
  client: RestoreStorageClient,
  key = signingKey(),
): Promise<PromotedRestoreStorage> {
  const manifest = [...validateRestoreDocumentManifest(backup, manifestValue)].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  const plan = verifyRestorePlan(planToken, key);
  assertPlanMatchesInput(plan, backup, manifest, userId);
  const manifestFromPlan = plan.entries.map(({ path, size, sha256 }) => ({ path, size, sha256 }));
  if (digest(manifestFromPlan) !== digest(manifest))
    throw new Error("Restore-Plan enthaelt ein abweichendes Dokumentmanifest.");

  const bucket = client.storage.from("documents");
  const createdFinalPaths: string[] = [];
  const stagingPaths = plan.entries.flatMap((entry) =>
    entry.stagingPath ? [entry.stagingPath] : [],
  );

  try {
    for (const entry of plan.entries) {
      if (entry.stagingPath) {
        await readAndVerify(bucket, entry.stagingPath, entry);
        if (await objectExists(bucket, entry.path)) {
          await readAndVerify(bucket, entry.path, entry);
          continue;
        }
        const { error } = await bucket.copy(entry.stagingPath, entry.path);
        if (error)
          throw new Error(
            `Dokumentdatei konnte nicht uebernommen werden (${entry.path}): ${error.message}`,
          );
        createdFinalPaths.push(entry.path);
        await readAndVerify(bucket, entry.path, entry);
      } else {
        if (!(await objectExists(bucket, entry.path)))
          throw new Error(`Vorhandene Dokumentdatei fehlt inzwischen: ${entry.path}.`);
        await readAndVerify(bucket, entry.path, entry);
      }
    }
    return { createdFinalPaths, stagingPaths };
  } catch (error) {
    try {
      await cleanupPaths(bucket, [...createdFinalPaths, ...stagingPaths]);
    } catch {
      // Ursprungsfehler bleibt massgeblich; Cleanup wird vom Aufrufer erneut versucht.
    }
    throw error;
  }
}
export async function cleanupRestoreStorage(
  client: RestoreStorageClient,
  paths: readonly string[],
): Promise<void> {
  await cleanupPaths(client.storage.from("documents"), [...paths]);
}
