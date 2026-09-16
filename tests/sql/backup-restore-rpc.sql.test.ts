import { afterEach, describe, expect, test } from "bun:test";
import type { PGlite } from "@electric-sql/pglite";

import { BACKUP_TABLES, type BackupData } from "@/lib/backup-tables";
import {
  createMigratedTestDatabase,
  useAuthenticatedUser,
  useServiceRole as setServiceRole,
} from "../support/sql-test-database";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THREAD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MESSAGE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
let db: PGlite | undefined;

async function snapshot(database: PGlite): Promise<BackupData> {
  const data: BackupData = {};
  for (const table of BACKUP_TABLES) {
    data[table] = (
      await database.query<Record<string, unknown>>(`select * from public."${table}";`)
    ).rows;
  }
  return data;
}

function counts(data: BackupData) {
  return Object.fromEntries(BACKUP_TABLES.map((table) => [table, data[table]!.length]));
}
async function seed(database: PGlite) {
  await setServiceRole(database);
  await database.query(
    `insert into auth.users (id,email) values ($1,'admin@test.local'),($2,'user@test.local');`,
    [ADMIN, USER],
  );
  await database.query(
    `insert into public.user_roles (user_id,role) values ($1,'admin') on conflict do nothing;`,
    [ADMIN],
  );
  await database.query(`delete from public.user_roles where user_id = $1;`, [USER]);
  await database.query(`insert into public.customers (name) values ('Backup Kunde');`);
  await database.query(
    `insert into public.chat_threads (id,titel,user_id) values ($1,'Backup Thread',$2);`,
    [THREAD, ADMIN],
  );
  await database.query(
    `insert into public.chat_messages (id,thread_id,rolle,inhalt,user_id) values ($1,$2,'user','synthetisch',$3);`,
    [MESSAGE, THREAD, ADMIN],
  );
}

afterEach(async () => {
  await db?.close();
  db = undefined;
});

describe("SQL-Runtime: Admin Restore RPC", () => {
  test("stellt als Admin den Snapshot atomar wieder her", async () => {
    db = await createMigratedTestDatabase();
    await seed(db);
    const backup = await snapshot(db);
    await setServiceRole(db);
    await db.exec(
      `delete from public.customers; insert into public.customers (name) values ('Soll verschwinden');`,
    );
    await useAuthenticatedUser(db, ADMIN);
    const result = await db.query<{ table_count: number; total_rows: string | number }>(
      `select * from public.ghasi_restore_backup($1::jsonb,$2::jsonb);`,
      [JSON.stringify(backup), JSON.stringify(counts(backup))],
    );
    expect(result.rows[0]?.table_count).toBe(BACKUP_TABLES.length);
    const customer = await db.query<{ name: string }>(`select name from public.customers;`);
    expect(customer.rows).toEqual([{ name: "Backup Kunde" }]);
  });

  test("blockiert Nicht-Admins vor jeder Datenaenderung", async () => {
    db = await createMigratedTestDatabase();
    await seed(db);
    const backup = await snapshot(db);
    await useAuthenticatedUser(db, USER);
    await expect(
      db.query(`select * from public.ghasi_restore_backup($1::jsonb,$2::jsonb);`, [
        JSON.stringify(backup),
        JSON.stringify(counts(backup)),
      ]),
    ).rejects.toThrow("Administratoren");
    await setServiceRole(db);
    const customer = await db.query<{ name: string }>(`select name from public.customers;`);
    expect(customer.rows).toEqual([{ name: "Backup Kunde" }]);
  });

  test("rollt bei ungueltigem Fremdschluessel den gesamten RPC-Aufruf zurueck", async () => {
    db = await createMigratedTestDatabase();
    await seed(db);
    const backup = await snapshot(db);
    backup.chat_messages![0] = {
      ...backup.chat_messages![0]!,
      thread_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    };
    await setServiceRole(db);
    await db.exec(
      `delete from public.customers; insert into public.customers (name) values ('Rollback Marker');`,
    );
    await useAuthenticatedUser(db, ADMIN);
    await expect(
      db.query(`select * from public.ghasi_restore_backup($1::jsonb,$2::jsonb);`, [
        JSON.stringify(backup),
        JSON.stringify(counts(backup)),
      ]),
    ).rejects.toThrow();
    await setServiceRole(db);
    const customer = await db.query<{ name: string }>(`select name from public.customers;`);
    expect(customer.rows).toEqual([{ name: "Rollback Marker" }]);
  });
});
