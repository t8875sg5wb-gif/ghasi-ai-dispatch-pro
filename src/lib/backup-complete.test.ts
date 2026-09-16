import { describe, expect, it } from "bun:test";

import { BACKUP_TABLES, type BackupData } from "@/lib/backup-tables";
import { prepareCompleteBackupZip } from "@/lib/backup-zip";

function dataMitDokumenten(): BackupData {
  const data = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as BackupData;
  data.documents = [
    { id: "doc-a", status: "active", storage_path: "synthetic/a.pdf" },
    { id: "doc-b", status: "active", storage_path: "synthetic/b.png" },
    { id: "doc-old", status: "pending_delete", storage_path: "synthetic/old.pdf" },
  ];
  return data;
}

const fetcher = async (input: string | URL | Request) => {
  const url = String(input);
  if (url.endsWith("/a")) return new Response(new Uint8Array([1, 2, 3]));
  if (url.endsWith("/b")) return new Response(new Uint8Array([4, 5]));
  return new Response("missing", { status: 404 });
};

describe("produktiver Backup-ZIP-Pfad mit Dokumentdateien", () => {
  it("nimmt automatisch alle aktiven Dokumentbytes auf", async () => {
    const prepared = await prepareCompleteBackupZip(
      dataMitDokumenten(),
      "snapshot-complete",
      [
        { path: "synthetic/a.pdf", signedUrl: "https://synthetic.invalid/a" },
        { path: "synthetic/b.png", signedUrl: "https://synthetic.invalid/b" },
      ],
      new Date("2026-09-14T12:00:00.000Z"),
      fetcher as typeof fetch,
    );

    expect(await prepared.zip.file("documents/synthetic/a.pdf")?.async("uint8array")).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(await prepared.zip.file("documents/synthetic/b.png")?.async("uint8array")).toEqual(
      new Uint8Array([4, 5]),
    );
    expect(prepared.zip.file("documents/synthetic/old.pdf")).toBeNull();
    expect(prepared.zip.file("ghasi-document-files.json")).not.toBeNull();
  });

  it("bricht den Export ab, wenn eine aktive Datei nicht geladen werden kann", async () => {
    await expect(
      prepareCompleteBackupZip(
        dataMitDokumenten(),
        "snapshot-complete",
        [
          { path: "synthetic/a.pdf", signedUrl: "https://synthetic.invalid/a" },
          { path: "synthetic/b.png", signedUrl: "https://synthetic.invalid/missing" },
        ],
        new Date("2026-09-14T12:00:00.000Z"),
        fetcher as typeof fetch,
      ),
    ).rejects.toThrow("synthetic/b.png");
  });
});
