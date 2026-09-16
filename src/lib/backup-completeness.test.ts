// Tests für den vollständigen Admin-Datenexport:
// 1) Die Tabellenliste deckt ALLE bekannten Tabellen des Schemas `public` ab.
// 2) Pagination führt mehr als 1000 Zeilen korrekt zusammen.
// 3) Ein Fehler auf einer späteren Seite macht die GANZE Tabelle fehlerhaft.
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  assertBackupComplete,
  BACKUP_PAGE_SIZE,
  BACKUP_TABLES,
  collectBackupData,
  type BackupClient,
} from "@/lib/backup-tables";

/**
 * Leitet den aktuellen public-Tabellenstand direkt aus allen Migrationen ab.
 * CREATE, DROP und RENAME werden in Migrationsreihenfolge angewendet.
 */
function tabellenAusMigrationen(): string[] {
  const migrationsDir = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
  const tabellen = new Set<string>();
  const dateien = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const datei of dateien) {
    const sql = readFileSync(`${migrationsDir}/${datei}`, "utf8")
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    for (const statement of sql.split(";")) {
      const create = statement.match(
        /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([A-Za-z_][A-Za-z0-9_]*)/i,
      );
      if (create?.[1]) tabellen.add(create[1]);

      const drop = statement.match(
        /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?["']?([A-Za-z_][A-Za-z0-9_]*)/i,
      );
      if (drop?.[1]) tabellen.delete(drop[1]);

      const rename = statement.match(
        /\bALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s+RENAME\s+TO\s+["']?([A-Za-z_][A-Za-z0-9_]*)/i,
      );
      if (rename?.[1] && rename[2] && tabellen.delete(rename[1])) tabellen.add(rename[2]);
    }
  }
  return [...tabellen].sort();
}

const BEKANNTE_TABELLEN = tabellenAusMigrationen();

/** Fake-Client: liefert je Tabelle vorgegebene Seiten bzw. Fehler. */
function fakeClient(
  seiten: Record<string, { data?: Record<string, unknown>[]; error?: string }[]>,
  aufrufe?: string[],
): BackupClient {
  const zaehler: Record<string, number> = {};
  return {
    from: (table) => ({
      select: () => ({
        range: (from: number, to: number) => {
          aufrufe?.push(`${table}:${from}-${to}`);
          const index = zaehler[table] ?? 0;
          zaehler[table] = index + 1;
          const seite = seiten[table]?.[index] ?? { data: [] };
          return Promise.resolve({
            data: seite.data ?? null,
            error: seite.error ? { message: seite.error } : null,
          });
        },
      }),
    }),
  };
}

function zeilen(anzahl: number, offset = 0): Record<string, unknown>[] {
  return Array.from({ length: anzahl }, (_, i) => ({ id: offset + i }));
}

describe("BACKUP_TABLES Vollständigkeit", () => {
  it("enthält jede bekannte Tabelle des Schemas public", () => {
    const fehlend = BEKANNTE_TABELLEN.filter(
      (t) => !(BACKUP_TABLES as readonly string[]).includes(t),
    );
    expect(fehlend).toEqual([]);
  });

  it("enthält keine unbekannten Tabellen und keine Duplikate", () => {
    const unbekannt = (BACKUP_TABLES as readonly string[]).filter(
      (t) => !(BEKANNTE_TABELLEN as readonly string[]).includes(t),
    );
    expect(unbekannt).toEqual([]);
    expect(new Set(BACKUP_TABLES).size).toBe(BACKUP_TABLES.length);
  });

  it("entspricht exakt der aktuell bekannten Tabellenzahl", () => {
    expect(BACKUP_TABLES.length).toBe(BEKANNTE_TABELLEN.length);
  });
});

describe("Vollst?ndigkeits-Gate", () => {
  it("l?sst einen vollst?ndigen Export passieren", () => {
    expect(() => assertBackupComplete([])).not.toThrow();
  });

  it("bricht einen Teil-Export mit den betroffenen Tabellen ab", () => {
    expect(() => assertBackupComplete(["documents", "invoices"])).toThrow(
      "Backup abgebrochen: documents, invoices konnte(n) nicht vollstaendig gesichert werden.",
    );
  });
});

describe("Pagination", () => {
  it("führt mehr als 1000 Zeilen einer Tabelle zusammen", async () => {
    const aufrufe: string[] = [];
    const client = fakeClient(
      {
        orders: [
          { data: zeilen(BACKUP_PAGE_SIZE, 0) },
          { data: zeilen(BACKUP_PAGE_SIZE, 1000) },
          { data: zeilen(250, 2000) },
        ],
      },
      aufrufe,
    );

    const { result, failedTables } = await collectBackupData(client, ["orders"]);
    expect(failedTables).toEqual([]);
    expect(result["orders"]).toHaveLength(2250);
    expect(result["orders"]?.[0]).toEqual({ id: 0 });
    expect(result["orders"]?.[2249]).toEqual({ id: 2249 });
    expect(aufrufe).toEqual(["orders:0-999", "orders:1000-1999", "orders:2000-2999"]);
  });

  it("hört nach einer unvollständigen ersten Seite auf zu blättern", async () => {
    const aufrufe: string[] = [];
    const client = fakeClient({ drivers: [{ data: zeilen(3) }] }, aufrufe);
    const { result } = await collectBackupData(client, ["drivers"]);
    expect(result["drivers"]).toHaveLength(3);
    expect(aufrufe).toEqual(["drivers:0-999"]);
  });

  it("liefert für eine leere Tabelle ein leeres Array ohne Fehler", async () => {
    const client = fakeClient({ profiles: [{ data: [] }] });
    const { result, failedTables } = await collectBackupData(client, ["profiles"]);
    expect(result["profiles"]).toEqual([]);
    expect(failedTables).toEqual([]);
  });
});

describe("Fehlerbehandlung", () => {
  it("wertet einen Fehler auf einer SPÄTEREN Seite als komplette Tabelle aus", async () => {
    const client = fakeClient({
      invoices: [{ data: zeilen(BACKUP_PAGE_SIZE, 0) }, { error: "permission denied" }],
    });
    const { result, failedTables } = await collectBackupData(client, ["invoices"]);
    expect(failedTables).toEqual(["invoices"]);
    // Kein Teilergebnis: die 1000 gelesenen Zeilen werden verworfen.
    expect(result["invoices"]).toEqual([]);
  });

  it("wertet einen Fehler auf der ersten Seite als fehlgeschlagen", async () => {
    const client = fakeClient({ documents: [{ error: "RLS" }] });
    const { result, failedTables } = await collectBackupData(client, ["documents"]);
    expect(failedTables).toEqual(["documents"]);
    expect(result["documents"]).toEqual([]);
  });

  it("isoliert Fehler je Tabelle und exportiert die übrigen vollständig", async () => {
    const client = fakeClient({
      orders: [{ data: zeilen(2) }],
      invoices: [{ error: "boom" }],
      drivers: [{ data: zeilen(1) }],
    });
    const { result, failedTables } = await collectBackupData(client, [
      "orders",
      "invoices",
      "drivers",
    ]);
    expect(failedTables).toEqual(["invoices"]);
    expect(result["orders"]).toHaveLength(2);
    expect(result["drivers"]).toHaveLength(1);
    expect(Object.keys(result)).toEqual(["orders", "invoices", "drivers"]);
  });

  it("fängt eine geworfene Ausnahme des Clients ab", async () => {
    const client: BackupClient = {
      from: () => ({
        select: () => ({
          range: () => {
            throw new Error("netzwerk");
          },
        }),
      }),
    };
    const { result, failedTables } = await collectBackupData(client, ["calls"]);
    expect(failedTables).toEqual(["calls"]);
    expect(result["calls"]).toEqual([]);
  });
});
