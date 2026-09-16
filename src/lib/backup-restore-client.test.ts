import { describe, expect, test } from "bun:test";

import {
  uploadRestoreStagingFiles,
  type RestoreUploadBucket,
  type RestoreUploadClient,
} from "@/lib/backup-restore-client";
import type { RestoreUploadInstruction } from "@/lib/backup-restore-storage.server";

const bytes = new Uint8Array([1, 2, 3]);
const upload: RestoreUploadInstruction = {
  finalPath: "synthetic/a.pdf",
  stagingPath: "_restore_staging/u/p/00000",
  token: "signed-token",
  size: 3,
  sha256: "0".repeat(64),
};

function client(error?: string) {
  const calls: unknown[][] = [];
  const bucket: RestoreUploadBucket = {
    uploadToSignedUrl: async (...args) => {
      calls.push(args);
      return { data: {}, error: error ? { message: error } : null };
    },
  };
  const restoreClient: RestoreUploadClient = { storage: { from: () => bucket } };
  return { restoreClient, calls };
}

describe("Restore-Staging-Upload", () => {
  test("laedt die lokal gepruefte Datei nur auf den signierten Staging-Pfad", async () => {
    const { restoreClient, calls } = client();
    const progress: number[] = [];
    await uploadRestoreStagingFiles(
      new Map([[upload.finalPath, bytes]]),
      [upload],
      restoreClient,
      (state) => progress.push(state.completed),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe(upload.stagingPath);
    expect(calls[0]?.[1]).toBe(upload.token);
    expect(calls[0]?.[2]).toEqual(bytes);
    expect(progress).toEqual([0, 1]);
  });

  test("blockiert fehlende oder lokal anders grosse Dateien vor dem Upload", async () => {
    const { restoreClient, calls } = client();
    await expect(uploadRestoreStagingFiles(new Map(), [upload], restoreClient)).rejects.toThrow(
      "fehlt lokal",
    );
    await expect(
      uploadRestoreStagingFiles(
        new Map([[upload.finalPath, new Uint8Array([1])]]),
        [upload],
        restoreClient,
      ),
    ).rejects.toThrow("falsche Groesse");
    expect(calls).toHaveLength(0);
  });

  test("gibt Storage-Uploadfehler sichtbar weiter", async () => {
    const { restoreClient } = client("upload down");
    await expect(
      uploadRestoreStagingFiles(new Map([[upload.finalPath, bytes]]), [upload], restoreClient),
    ).rejects.toThrow("upload down");
  });
});
