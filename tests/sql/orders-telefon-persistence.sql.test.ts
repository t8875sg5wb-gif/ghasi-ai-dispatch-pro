import { afterEach, describe, expect, test } from "bun:test";
import type { PGlite } from "@electric-sql/pglite";

import {
  createMigratedTestDatabase,
  useAuthenticatedUser,
  useServiceRole,
} from "../support/sql-test-database";

const DISPO = "12121212-1212-4121-8121-121212121212";
const ORDER = "34343434-3434-4343-8343-343434343434";
let db: PGlite | undefined;

afterEach(async () => {
  await db?.close();
  db = undefined;
});

describe("SQL-Runtime: orders.telefon Persistenz", () => {
  test("Disposition kann Telefonnummer aendern und frisch aus der DB lesen", async () => {
    db = await createMigratedTestDatabase();
    await useServiceRole(db);
    await db.query(`insert into auth.users (id,email) values ($1,'dispo@test.local');`, [DISPO]);
    await db.query(`insert into public.user_roles (user_id,role) values ($1,'disposition');`, [
      DISPO,
    ]);
    await db.query(
      `insert into public.orders
         (id, nummer, patient, transportart, prioritaet, status,
          abholort, zielort, termin, telefon)
       values
         ($1,'A-TEST-TEL','Synthetischer Patient','Sitzendtransport','normal','neu',
          'Testweg 1, 32423 Minden','Testweg 2, 32423 Minden',
          '2026-09-15T10:00:00+02:00','');`,
      [ORDER],
    );

    await useAuthenticatedUser(db, DISPO);
    const updated = await db.query<{ telefon: string | null }>(
      `update public.orders set telefon=$2 where id=$1 returning telefon;`,
      [ORDER, "0571 9998877"],
    );
    expect(updated.rows).toEqual([{ telefon: "0571 9998877" }]);

    const asDispo = await db.query<{ telefon: string | null }>(
      `select telefon from public.orders where id=$1;`,
      [ORDER],
    );
    expect(asDispo.rows).toEqual([{ telefon: "0571 9998877" }]);

    await useServiceRole(db);
    const fresh = await db.query<{ telefon: string | null }>(
      `select telefon from public.orders where id=$1;`,
      [ORDER],
    );
    expect(fresh.rows).toEqual([{ telefon: "0571 9998877" }]);
  });
});
