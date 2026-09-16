import { BACKUP_TABLES } from "@/lib/backup-tables";
import { parseRestoreBackup, type RestoreBackup } from "@/lib/backup-restore";

export interface RestoreDatabase {
  exec(sql: string): Promise<unknown>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export const RESTORE_REPLAY_LAST = [
  "activity_log",
  "ai_audit_log",
  "ai_audit_log_archive",
  "employment_audit_log",
  "invoice_audit_snapshots",
  "invoice_changes",
  "payroll_fact_audit_log",
  "payroll_rule_audit_log",
  "payroll_run_audit_log",
] as const;

const replayLast = new Set<string>(RESTORE_REPLAY_LAST);

function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

type ForeignKeyEdge = { child_table: string; parent_table: string };
type ColumnRow = {
  table_name: string;
  column_name: string;
  is_generated: string;
  is_identity: string;
};

async function assertSchemaMatches(db: RestoreDatabase): Promise<Map<string, string[]>> {
  const tables = await db.query<{ table_name: string }>(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name;
  `);
  const expected = [...BACKUP_TABLES].sort();
  const actual = tables.rows.map((row) => row.table_name).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      "Restore abgebrochen: Das aktuelle public-Schema passt nicht zum Backup-Format.",
    );
  }

  const columns = await db.query<ColumnRow>(`
    select table_name, column_name, is_generated, is_identity
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position;
  `);

  const unsupported = columns.rows.filter(
    (row) => row.is_generated !== "NEVER" || row.is_identity === "YES",
  );
  if (unsupported.length > 0) {
    throw new Error(
      "Restore abgebrochen: Generierte oder Identity-Spalten werden noch nicht unterstuetzt.",
    );
  }

  const byTable = new Map<string, string[]>();
  for (const row of columns.rows) {
    const list = byTable.get(row.table_name) ?? [];
    list.push(row.column_name);
    byTable.set(row.table_name, list);
  }
  return byTable;
}

function assertRowColumns(backup: RestoreBackup, columns: Map<string, string[]>): void {
  for (const table of BACKUP_TABLES) {
    const expected = columns.get(table);
    if (!expected) throw new Error(`Restore abgebrochen: Schema fuer ${table} fehlt.`);
    const expectedSorted = [...expected].sort();
    for (const row of backup.data[table]!) {
      const actualSorted = Object.keys(row).sort();
      if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
        throw new Error(
          `Restore abgebrochen: Spalten von ${table} passen nicht zum aktuellen Schema.`,
        );
      }
    }
  }
}

async function foreignKeyOrder(db: RestoreDatabase): Promise<string[]> {
  const result = await db.query<ForeignKeyEdge>(`
    select child.relname as child_table, parent.relname as parent_table
    from pg_constraint con
    join pg_class child on child.oid = con.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join pg_class parent on parent.oid = con.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
    where con.contype = 'f'
      and child_ns.nspname = 'public'
      and parent_ns.nspname = 'public';
  `);

  const tables: string[] = [...BACKUP_TABLES];
  const indegree = new Map<string, number>(tables.map((table) => [table, 0]));
  const children = new Map<string, Set<string>>();
  for (const edge of result.rows) {
    if (edge.child_table === edge.parent_table) continue;
    if (!indegree.has(edge.child_table) || !indegree.has(edge.parent_table)) continue;
    const set = children.get(edge.parent_table) ?? new Set<string>();
    if (!set.has(edge.child_table)) {
      set.add(edge.child_table);
      children.set(edge.parent_table, set);
      indegree.set(edge.child_table, (indegree.get(edge.child_table) ?? 0) + 1);
    }
  }

  const queue = tables.filter((table) => indegree.get(table) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const table = queue.shift()!;
    order.push(table);
    for (const child of children.get(table) ?? []) {
      const next = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, next);
      if (next === 0) queue.push(child);
    }
  }
  if (order.length !== tables.length) {
    throw new Error(
      "Restore abgebrochen: Zyklische public-Fremdschluessel werden noch nicht unterstuetzt.",
    );
  }

  for (const edge of result.rows) {
    if (replayLast.has(edge.parent_table) && !replayLast.has(edge.child_table)) {
      throw new Error(
        `Restore abgebrochen: ${edge.child_table} haengt von spaet wiederhergestelltem ${edge.parent_table} ab.`,
      );
    }
  }
  return order;
}

async function insertTable(
  db: RestoreDatabase,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const columnSql = columns.map(quoteIdent).join(", ");
  const tableSql = `public.${quoteIdent(table)}`;
  await db.query(
    `insert into ${tableSql} (${columnSql})
     select ${columnSql}
     from jsonb_populate_recordset(null::${tableSql}, $1::jsonb);`,
    [JSON.stringify(rows)],
  );
}

async function verifyCounts(db: RestoreDatabase, backup: RestoreBackup): Promise<void> {
  for (const table of BACKUP_TABLES) {
    const result = await db.query<{ count: string | number }>(
      `select count(*) as count from public.${quoteIdent(table)};`,
    );
    const actual = Number(result.rows[0]?.count ?? -1);
    const expected = backup.manifest.rowCounts[table];
    if (actual !== expected) {
      throw new Error(
        `Restore abgebrochen: Zeilenzahl von ${table} ist ${actual}, erwartet ${expected}.`,
      );
    }
  }
}

function truncateSql(tables: readonly string[]): string {
  return `truncate table ${tables.map((table) => `public.${quoteIdent(table)}`).join(", ")};`;
}

export async function restoreBackupTransactionally(
  db: RestoreDatabase,
  candidate: RestoreBackup,
  verifyRecovery: (candidate: RestoreBackup) => Promise<void>,
): Promise<{ tables: number; rows: number }> {
  const backup = parseRestoreBackup(JSON.stringify(candidate));
  await verifyRecovery(backup);
  const columns = await assertSchemaMatches(db);
  assertRowColumns(backup, columns);
  const order = await foreignKeyOrder(db);
  const normalOrder = order.filter((table) => !replayLast.has(table));
  const replayOrder = order.filter((table) => replayLast.has(table));

  await db.exec("begin;");
  try {
    await db.exec(truncateSql(BACKUP_TABLES));
    for (const table of normalOrder) {
      await insertTable(db, table, columns.get(table)!, backup.data[table]!);
    }

    if (replayOrder.length > 0) {
      await db.exec(truncateSql(replayOrder));
      for (const table of replayOrder) {
        await insertTable(db, table, columns.get(table)!, backup.data[table]!);
      }
    }

    await verifyCounts(db, backup);
    await db.exec("commit;");
    return { tables: BACKUP_TABLES.length, rows: backup.manifest.totalRows };
  } catch (error) {
    try {
      await db.exec("rollback;");
    } catch {
      throw new Error("Restore fehlgeschlagen und Rollback konnte nicht bestaetigt werden.", {
        cause: error,
      });
    }
    throw new Error("Restore fehlgeschlagen. Alle Datenbankaenderungen wurden zurueckgerollt.", {
      cause: error,
    });
  }
}
