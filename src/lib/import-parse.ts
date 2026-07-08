// Client-side CSV/XLSX parsing for the bulk data importer.
// Uses SheetJS which transparently handles both formats.
import * as XLSX from "xlsx";

export interface ParsedSheet {
  headers: string[];
  /** Each row keyed by the original header text. */
  rows: Record<string, string>[];
}

/** Read a File (CSV or XLSX) into headers + row objects. */
export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const first = wb.SheetNames[0];
  if (!first) return { headers: [], rows: [] };
  const sheet = wb.Sheets[first];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  if (matrix.length === 0) return { headers: [], rows: [] };

  const rawHeaders = (matrix[0] ?? []).map((h) => String(h ?? "").trim());
  const headers = rawHeaders.filter((h) => h.length > 0);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    const row: Record<string, string> = {};
    let hasValue = false;
    rawHeaders.forEach((h, idx) => {
      if (!h) return;
      const v = String(cells[idx] ?? "").trim();
      row[h] = v;
      if (v) hasValue = true;
    });
    if (hasValue) rows.push(row);
  }
  return { headers, rows };
}
