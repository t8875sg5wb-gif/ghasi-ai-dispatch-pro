// Tabellenliste und Sammel-Logik für den vollständigen Admin-Datenexport.
// Bewusst in einer eigenen Datei (kein *.functions.ts), damit die Laufzeit-
// Helfer beim Server-Function-Splitting nicht entfernt werden und testbar sind.

/**
 * Alle Tabellen des Schemas `public`, gruppiert. Der Export versteht sich als
 * VOLLSTÄNDIGER Datenexport – es wird keine Auswahl getroffen, Audit-Logs
 * gehören dazu.
 */
export const BACKUP_TABLES = [
  // --- Stammdaten ---
  "drivers",
  "vehicles",
  "customers",
  "patients",
  "facilities",
  "insurers",
  // --- Aufträge & Disposition ---
  "orders",
  "recurring_orders",
  "driver_shifts",
  "vehicle_trips",
  // --- Payroll / Personal ---
  "employment_relationships",
  "payroll_facts",
  "payroll_rules",
  "payroll_runs",
  "payroll_run_items",
  // --- Finanzen ---
  "invoices",
  "expenses",
  "insurance_policies",
  "insurer_contracts",
  "leasing_contracts",
  // --- Compliance & Dokumente ---
  "verordnungen",
  "documents",
  "document_cleanup_jobs",
  // --- Kommunikation ---
  "calls",
  "conversations",
  "communication_drafts",
  "chat_threads",
  "chat_messages",
  // --- System & Konfiguration ---
  "company_settings",
  "automation_states",
  "profiles",
  "user_roles",
  "ghasi_memory",
  // --- Audit-Logs ---
  "activity_log",
  "ai_audit_log",
  "employment_audit_log",
  "invoice_audit_snapshots",
  "invoice_changes",
  "payroll_fact_audit_log",
  "payroll_rule_audit_log",
  "payroll_run_audit_log",
] as const;

export type BackupData = Record<string, Record<string, unknown>[]>;

/** PostgREST liefert ohne `.range()` maximal 1000 Zeilen pro Anfrage. */
export const BACKUP_PAGE_SIZE = 1000;

type PageResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
};

export type BackupClient = {
  from: (table: string) => {
    select: (columns: string) => {
      range: (from: number, to: number) => PromiseLike<PageResult>;
    };
  };
};

/**
 * Liest jede Tabelle seitenweise vollständig aus.
 *
 * - Es wird geblättert, bis eine Seite weniger als `BACKUP_PAGE_SIZE` Zeilen
 *   liefert; dadurch gehen bei mehr als 1000 Zeilen keine Daten still verloren.
 * - Schlägt EINE Seite fehl, gilt die GANZE Tabelle als fehlgeschlagen: sie
 *   landet in `failedTables` und wird als leeres Array ausgegeben. Es gibt
 *   niemals ein Teilergebnis, das wie ein vollständiges aussieht.
 */
export async function collectBackupData(
  client: BackupClient,
  tables: readonly string[] = BACKUP_TABLES,
): Promise<{ result: BackupData; failedTables: string[] }> {
  const result: BackupData = {};
  const failedTables: string[] = [];

  for (const table of tables) {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    let ok = true;

    try {
      for (;;) {
        const { data, error } = await client
          .from(table)
          .select("*")
          .range(offset, offset + BACKUP_PAGE_SIZE - 1);
        if (error) {
          ok = false;
          break;
        }
        const seite = data ?? [];
        rows.push(...seite);
        if (seite.length < BACKUP_PAGE_SIZE) break;
        offset += BACKUP_PAGE_SIZE;
      }
    } catch {
      ok = false;
    }

    if (ok) {
      result[table] = rows;
    } else {
      failedTables.push(table);
      result[table] = [];
    }
  }

  return { result, failedTables };
}
