import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { PGlite } from "@electric-sql/pglite";

import { BACKUP_TABLES } from "../../src/lib/backup-tables";
import {
  createMigratedTestDatabase,
  useAuthenticatedUser,
  useServiceRole,
} from "../support/sql-test-database";

const ADMIN_USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAHRER_USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type SnapshotRow = {
  table_name: string;
  rows: unknown[];
  row_count: string | number;
  snapshot_id: string;
};

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedTestDatabase();
  await useServiceRole(db);
  await db.query(
    `insert into auth.users (id, email) values ($1,'admin-backup@test.local'),($2,'fahrer-backup@test.local');`,
    [ADMIN_USER, FAHRER_USER],
  );
  await db.query(`delete from public.user_roles where user_id in ($1,$2);`, [
    ADMIN_USER,
    FAHRER_USER,
  ]);
  await db.query(
    `insert into public.user_roles (user_id, role) values ($1,'admin'),($2,'fahrer');`,
    [ADMIN_USER, FAHRER_USER],
  );
});

afterAll(async () => {
  await db?.close();
});

describe("SQL-Runtime: konsistenter Backup-Snapshot", () => {
  test("RPC ist STABLE, gehaertet SECURITY DEFINER und nur fuer authenticated freigegeben", async () => {
    await useServiceRole(db);
    const meta = await db.query<{
      provolatile: string;
      prosecdef: boolean;
      acl: string[] | null;
      proconfig: string[] | null;
    }>(`
      select p.provolatile, p.prosecdef, p.proacl::text[] as acl, p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='ghasi_backup_snapshot';
    `);
    expect(meta.rows).toHaveLength(1);
    expect(meta.rows[0]!.provolatile).toBe("s");
    expect(meta.rows[0]!.prosecdef).toBe(true);
    expect(meta.rows[0]!.proconfig).toEqual(["search_path=pg_catalog"]);
  });

  test("Admin erhaelt alle 43 Tabellen aus genau einem Snapshot", async () => {
    await useAuthenticatedUser(db, ADMIN_USER);
    const result = await db.query<SnapshotRow>(
      `select table_name, rows, row_count, snapshot_id from public.ghasi_backup_snapshot();`,
    );

    expect(result.rows.map((row) => row.table_name).sort()).toEqual([...BACKUP_TABLES].sort());
    expect(new Set(result.rows.map((row) => row.snapshot_id)).size).toBe(1);
    for (const row of result.rows) {
      expect(Array.isArray(row.rows)).toBe(true);
      expect(Number(row.row_count)).toBe(row.rows.length);
    }
  });

  test("Nicht-Admin kann den Snapshot nicht abrufen", async () => {
    await useAuthenticatedUser(db, FAHRER_USER);
    let message = "";
    try {
      await db.query(`select * from public.ghasi_backup_snapshot();`);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("Backup-Snapshot ist Administratoren vorbehalten");
  });

  test("anon besitzt kein Execute-Recht", async () => {
    await useServiceRole(db);
    const rights = await db.query<{ allowed: boolean }>(
      `select has_function_privilege('anon', 'public.ghasi_backup_snapshot()', 'EXECUTE') as allowed;`,
    );
    expect(rights.rows[0]!.allowed).toBe(false);
  });
});
