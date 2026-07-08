// Client-side CSV export helpers used by Fahrtenbuch, DATEV and backup exports.

/** Serialise an array of flat records to a CSV string (semicolon-separated, Excel/DE-friendly). */
export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0 && !headers) return "";
  const cols = headers ?? Object.keys(rows[0] ?? {});
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = cols.map(escape).join(";");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(";")).join("\n");
  return `${head}\n${body}`;
}

/** Trigger a browser download of a text file. */
export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([`\uFEFF${content}`], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, csv: string) {
  downloadText(filename, csv, "text/csv");
}
