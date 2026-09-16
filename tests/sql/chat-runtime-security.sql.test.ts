import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { PGlite } from "@electric-sql/pglite";

import {
  createMigratedTestDatabase,
  useAuthenticatedUser,
  useServiceRole,
} from "../support/sql-test-database";

const USER_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
let db: PGlite;
let threadA = "";
let threadB = "";

async function denied(run: () => Promise<unknown>) {
  let message = "";
  try {
    await run();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  expect(message.length).toBeGreaterThan(0);
  return message;
}

beforeAll(async () => {
  db = await createMigratedTestDatabase();
  await useServiceRole(db);
  await db.query(
    `insert into auth.users (id,email) values ($1,'a@test.local'),($2,'b@test.local');`,
    [USER_A, USER_B],
  );
  await db.query(`delete from public.user_roles where user_id in ($1,$2);`, [USER_A, USER_B]);
  await db.query(
    `insert into public.user_roles (user_id, role) values ($1,'admin'),($2,'disposition');`,
    [USER_A, USER_B],
  );
});

afterAll(async () => {
  await db?.close();
});

describe("SQL-Runtime: Chat-RLS ohne Service-Role", () => {
  test("Nutzer können nur Threads mit eigener user_id anlegen", async () => {
    await useAuthenticatedUser(db, USER_A);
    const own = await db.query<{ id: string }>(
      `insert into public.chat_threads (titel,user_id) values ('A',$1) returning id;`,
      [USER_A],
    );
    threadA = own.rows[0]!.id;
    const message = await denied(() =>
      db.query(`insert into public.chat_threads (titel,user_id) values ('fremd',$1);`, [USER_B]),
    );
    expect(message.toLowerCase()).toContain("row-level security");
  });

  test("zweiter Nutzer kann eigenen Thread anlegen", async () => {
    await useAuthenticatedUser(db, USER_B);
    const own = await db.query<{ id: string }>(
      `insert into public.chat_threads (titel,user_id) values ('B',$1) returning id;`,
      [USER_B],
    );
    threadB = own.rows[0]!.id;
    expect(threadB).toBeTruthy();
  });
  test("Nachrichten dürfen nur im eigenen Thread gespeichert werden", async () => {
    await useAuthenticatedUser(db, USER_A);
    const own = await db.query<{ id: string }>(
      `insert into public.chat_messages (thread_id,rolle,inhalt,user_id)
       values ($1,'user','Hallo',$2) returning id;`,
      [threadA, USER_A],
    );
    expect(own.rows[0]!.id).toBeTruthy();

    const foreign = await denied(() =>
      db.query(
        `insert into public.chat_messages (thread_id,rolle,inhalt,user_id)
         values ($1,'user','Nein',$2);`,
        [threadB, USER_A],
      ),
    );
    expect(foreign.toLowerCase()).toContain("row-level security");
  });

  test("fremde Threads lassen sich weder ändern noch löschen", async () => {
    await useAuthenticatedUser(db, USER_A);
    const update = await db.query<{ id: string }>(
      `update public.chat_threads set titel='gehackt' where id=$1 returning id;`,
      [threadB],
    );
    expect(update.rows).toHaveLength(0);
    const del = await db.query<{ id: string }>(
      `delete from public.chat_threads where id=$1 returning id;`,
      [threadB],
    );
    expect(del.rows).toHaveLength(0);

    await useServiceRole(db);
    const check = await db.query<{ titel: string }>(
      `select titel from public.chat_threads where id=$1;`,
      [threadB],
    );
    expect(check.rows[0]!.titel).toBe("B");
  });
  test("authenticated kann das KI-Audit nicht direkt manipulieren", async () => {
    await useAuthenticatedUser(db, USER_A);
    const message = await denied(() =>
      db.query(
        `insert into public.ai_audit_log (user_id, rolle, modell, erfolg)
         values ($1,'admin','fake',true);`,
        [USER_A],
      ),
    );
    expect(message.toLowerCase()).toMatch(/permission|denied|privilege/);
  });

  test("es gibt keine browser-aufrufbare Audit-Schreib-RPC", async () => {
    await useServiceRole(db);
    const proc = await db.query<{ fn: string | null }>(
      `select to_regprocedure(
        'public.write_ai_audit_metadata(text,uuid,text[],integer,boolean,jsonb,jsonb)'
      )::text as fn;`,
    );
    expect(proc.rows[0]!.fn).toBeNull();
  });
});
