// Client-side helper: turns the raw backup JSON (from exportAllData) into a
// ZIP archive containing one CSV per domain table, then triggers a download.
import JSZip from "jszip";

import { toCsv } from "@/lib/export-utils";
import type { BackupData } from "@/lib/backup.functions";

/** Build a ZIP of CSV files (one per table) and trigger a browser download. */
export async function downloadBackupZip(data: BackupData): Promise<{ tables: number; rows: number }> {
  const zip = new JSZip();
  let totalRows = 0;
  let tableCount = 0;

  for (const [table, rows] of Object.entries(data)) {
    tableCount += 1;
    totalRows += rows.length;
    // Flatten nested objects to JSON strings so every cell is CSV-safe.
    const flatRows = rows.map((row) => {
      const flat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        flat[k] = v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      }
      return flat;
    });
    const csv = toCsv(flatRows);
    // Prefix with BOM so Excel opens UTF-8 correctly.
    zip.file(`${table}.csv`, `\uFEFF${csv}`);
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ghasi-backup-${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { tables: tableCount, rows: totalRows };
}
