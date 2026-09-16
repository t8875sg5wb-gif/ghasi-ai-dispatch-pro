import { afterEach, describe, expect, test } from "bun:test";
import type { PGlite } from "@electric-sql/pglite";

import { BACKUP_TABLES, type BackupData } from "@/lib/backup-tables";
import { AUTH_USER_REFERENCES, createRestoreBackup } from "@/lib/backup-restore";
import { restoreBackupTransactionally } from "@/lib/backup-restore-transaction";
import {
  createMigratedTestDatabase,
  useServiceRole as setServiceRole,
} from "../support/sql-test-database";

const AUTH_USER = "11111111-1111-4111-8111-111111111111";
const verifyRecoveryOk = async () => {};
const verifyRecoveryMissing = async () => {
  throw new Error("Auth-Benutzer fehlt");
};

const THREAD_ID = "22222222-2222-4222-8222-222222222222";
const MESSAGE_ID = "33333333-3333-4333-8333-333333333333";
let db: PGlite | undefined;

async function snapshot(database: PGlite): Promise<BackupData> {
  const data: BackupData = {};
  for (const table of BACKUP_TABLES) {
    const result = await database.query<Record<string, unknown>>(
      `select * from public."${table}";`,
    );
    data[table] = result.rows;
  }
  return data;
}

function canonical(data: BackupData): Record<string, string[]> {
  return Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, data[table]!.map((row) => JSON.stringify(row)).sort()]),
  );
}

afterEach(async () => {
  await db?.close();
  db = undefined;
});

async function seedSuccessfulSnapshot(database: PGlite): Promise<BackupData> {
  await setServiceRole(database);
  await database.query(`insert into auth.users (id, email) values ($1, 'restore@test.local');`, [
    AUTH_USER,
  ]);

  await database.query(`insert into public.customers (name) values ('Restore Testkunde');`);
  await database.query(
    `insert into public.chat_threads (id, titel) values ($1, 'Restore Thread');`,
    [THREAD_ID],
  );
  await database.query(
    `insert into public.chat_messages (id, thread_id, rolle, inhalt) values ($1, $2, 'user', 'synthetisch');`,
    [MESSAGE_ID, THREAD_ID],
  );
  await database.query(
    `insert into public.payroll_rules
      (kennung, bezeichnung, kategorie, berechnungsart, festbetrag, gueltig_ab, quelle, quelle_version)
     values ('restore_test', 'Restore Testregel', 'arbeitnehmerabzug', 'festbetrag', 10,
       '2026-01-01', 'Synthetischer Test', '1');`,
  );
  return snapshot(database);
}

describe("SQL-Runtime: Backup-Restore", () => {
  test("stellt einen vollstaendigen public-Snapshot exakt wieder her", async () => {
    db = await createMigratedTestDatabase();
    const before = await seedSuccessfulSnapshot(db);
    const auditBefore = before.payroll_rule_audit_log!.length;
    expect(auditBefore).toBeGreaterThan(0);

    await db.query(`insert into public.customers (name) values ('Soll verschwinden');`);
    await db.query(`update public.chat_threads set titel = 'Veraendert' where id = $1;`, [
      THREAD_ID,
    ]);

    const result = await restoreBackupTransactionally(
      db,
      createRestoreBackup(before, "sql-test-snapshot"),
      verifyRecoveryOk,
    );
    const after = await snapshot(db);

    expect(result.tables).toBe(BACKUP_TABLES.length);
    expect(result.rows).toBe(Object.values(before).reduce((sum, rows) => sum + rows.length, 0));
    expect(canonical(after)).toEqual(canonical(before));
    expect(after.payroll_rule_audit_log).toHaveLength(auditBefore);
  });

  test("rollt alles zurueck, wenn ein benoetigter Auth-Benutzer fehlt", async () => {
    db = await createMigratedTestDatabase();
    const backupData = await seedSuccessfulSnapshot(db);
    await setServiceRole(db);
    await db.query(`delete from public.user_roles where user_id = $1;`, [AUTH_USER]);
    await db.query(`delete from auth.users where id = $1;`, [AUTH_USER]);
    await db.query(`delete from public.customers;`);
    await db.query(`insert into public.customers (name) values ('Vorheriger Zustand');`);

    await expect(
      restoreBackupTransactionally(
        db,
        createRestoreBackup(backupData, "sql-test-snapshot"),
        verifyRecoveryOk,
      ),
    ).rejects.toThrow();

    const customers = await db.query<{ name: string }>(`select name from public.customers;`);
    expect(customers.rows).toEqual([{ name: "Vorheriger Zustand" }]);
  });

  test("rollt alles zurueck, wenn interne Fremdschluessel im Backup ungueltig sind", async () => {
    db = await createMigratedTestDatabase();
    await setServiceRole(db);
    await db.query(`insert into public.customers (name) values ('Rollback Marker');`);

    const invalid = await snapshot(db);
    invalid.chat_messages = [
      {
        id: MESSAGE_ID,
        thread_id: THREAD_ID,
        rolle: "user",
        inhalt: "ungueltiger Fremdschluessel",
        parts: null,
        quellen: null,
        user_id: null,
        created_at: new Date().toISOString(),
      },
    ];

    await expect(
      restoreBackupTransactionally(
        db,
        createRestoreBackup(invalid, "sql-test-snapshot"),
        verifyRecoveryOk,
      ),
    ).rejects.toThrow();
    const customers = await db.query<{ name: string }>(`select name from public.customers;`);
    expect(customers.rows).toEqual([{ name: "Rollback Marker" }]);
  });

  test("blockiert vor der Transaktion, wenn externe Voraussetzungen nicht bestaetigt sind", async () => {
    db = await createMigratedTestDatabase();
    const backupData = await seedSuccessfulSnapshot(db);
    await db.query(`delete from public.customers;`);
    await db.query(`insert into public.customers (name) values ('Preflight Marker');`);

    await expect(
      restoreBackupTransactionally(
        db,
        createRestoreBackup(backupData, "sql-test-snapshot"),
        verifyRecoveryMissing,
      ),
    ).rejects.toThrow("Auth-Benutzer");

    const customers = await db.query<{ name: string }>(`select name from public.customers;`);
    expect(customers.rows).toEqual([{ name: "Preflight Marker" }]);
  });

  test("Auth-Recovery-Liste entspricht exakt den echten public-zu-auth.users-Fremdschluesseln", async () => {
    db = await createMigratedTestDatabase();
    const result = await db.query<{ table_name: string; column_name: string }>(`
      select child.relname as table_name, attr.attname as column_name
      from pg_constraint con
      join pg_class child on child.oid = con.conrelid
      join pg_namespace child_ns on child_ns.oid = child.relnamespace
      join pg_class parent on parent.oid = con.confrelid
      join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
      join unnest(con.conkey) with ordinality as key(attnum, ord) on true
      join pg_attribute attr on attr.attrelid = child.oid and attr.attnum = key.attnum
      where con.contype = 'f'
        and child_ns.nspname = 'public'
        and parent_ns.nspname = 'auth'
        and parent.relname = 'users'
      order by table_name, column_name;
    `);
    const actual = result.rows.map((row) => `${row.table_name}.${row.column_name}`);
    const expected = AUTH_USER_REFERENCES.map((ref) => `${ref.table}.${ref.column}`).sort();
    expect(actual).toEqual(expected);
  });
});
