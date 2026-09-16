export interface NamePageResult {
  data: Array<{ name?: string | null }> | null;
  error: { message?: string } | null;
}

export async function loadAllNamesPaged(
  fetchPage: (from: number, to: number) => Promise<NamePageResult>,
  pageSize = 500,
): Promise<string[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error("Ungültige Seitengröße.");

  const names: string[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) {
      throw new Error(result.error.message || "Personennamen konnten nicht sicher geprüft werden.");
    }
    const rows = result.data ?? [];
    for (const row of rows) {
      if (typeof row.name === "string" && row.name.trim()) names.push(row.name.trim());
    }
    if (rows.length < pageSize) break;
  }
  return names;
}
