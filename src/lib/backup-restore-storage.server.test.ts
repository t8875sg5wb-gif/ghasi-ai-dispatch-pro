import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { BACKUP_TABLES, type BackupData } from "@/lib/backup-tables";
import { createRestoreBackup } from "@/lib/backup-restore";
import {
  prepareRestoreStoragePlan,
  verifyAndPromoteRestoreStorage,
  verifyRestorePlan,
  type RestoreStorageBucket,
  type RestoreStorageClient,
} from "@/lib/backup-restore-storage.server";

const KEY = "synthetic-signing-key";
const USER = "11111111-1111-4111-8111-111111111111";
const bytesA = new Uint8Array([1, 2, 3]);
const bytesB = new Uint8Array([4, 5, 6, 7]);
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function backup() {
  const data = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as BackupData;
  data.documents = [
    { id: "a", status: "active", storage_path: "synthetic/a.pdf" },
    { id: "b", status: "active", storage_path: "synthetic/b.pdf" },
  ];
  return createRestoreBackup(data, "storage-plan-test");
}
function manifest() {
  return [
    { path: "synthetic/a.pdf", size: bytesA.byteLength, sha256: hash(bytesA) },
    { path: "synthetic/b.pdf", size: bytesB.byteLength, sha256: hash(bytesB) },
  ];
}

function storage(initial: Record<string, Uint8Array> = {}) {
  const objects = new Map<string, Uint8Array>(Object.entries(initial));
  const bucket: RestoreStorageBucket = {
    exists: async (path) => ({ data: objects.has(path), error: null }),
    download: async (path) => ({
      data: objects.has(path) ? new Blob([Uint8Array.from(objects.get(path)!)]) : null,
      error: objects.has(path) ? null : { message: "not found" },
    }),
    createSignedUploadUrl: async (path) => ({ data: { token: `token:${path}` }, error: null }),
    copy: async (fromPath, toPath) => {
      const source = objects.get(fromPath);
      if (!source) return { data: null, error: { message: "missing source" } };
      objects.set(toPath, Uint8Array.from(source));
      return { data: {}, error: null };
    },
    remove: async (paths) => {
      paths.forEach((path) => objects.delete(path));
      return { data: {}, error: null };
    },
  };
  const client: RestoreStorageClient = { storage: { from: () => bucket } };
  return { client, objects };
}
describe("Restore-Storage-Plan", () => {
  test("nutzt vorhandene hashgleiche Datei und stagiert nur fehlende Datei", async () => {
    const { client, objects } = storage({ "synthetic/a.pdf": bytesA });
    const candidate = backup();
    const prepared = await prepareRestoreStoragePlan(candidate, manifest(), USER, client, KEY);
    expect(prepared.alreadyPresent).toBe(1);
    expect(prepared.uploads).toHaveLength(1);
    expect(prepared.uploads[0]!.finalPath).toBe("synthetic/b.pdf");

    const upload = prepared.uploads[0]!;
    objects.set(upload.stagingPath, Uint8Array.from(bytesB));
    const promoted = await verifyAndPromoteRestoreStorage(
      prepared.planToken,
      candidate,
      manifest(),
      USER,
      client,
      KEY,
    );
    expect(promoted.createdFinalPaths).toEqual(["synthetic/b.pdf"]);
    expect(objects.get("synthetic/b.pdf")).toEqual(bytesB);
  });

  test("blockiert manipulierten signierten Plan", async () => {
    const { client } = storage({ "synthetic/a.pdf": bytesA, "synthetic/b.pdf": bytesB });
    const prepared = await prepareRestoreStoragePlan(backup(), manifest(), USER, client, KEY);
    const [body, signature] = prepared.planToken.split(".");
    const tampered = `${body!.slice(0, -1)}A.${signature}`;
    expect(() => verifyRestorePlan(tampered, KEY)).toThrow("Signatur");
  });
  test("blockiert vorhandene Datei mit abweichendem Inhalt", async () => {
    const { client } = storage({
      "synthetic/a.pdf": new Uint8Array([9, 9, 9]),
      "synthetic/b.pdf": bytesB,
    });
    await expect(
      prepareRestoreStoragePlan(backup(), manifest(), USER, client, KEY),
    ).rejects.toThrow("SHA-256");
  });
});
