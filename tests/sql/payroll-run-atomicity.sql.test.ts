/**
 * ECHTE SQL-Runtime-Tests (PGlite / WASM-Postgres).
 *
 * Diese Tests fuehren die tatsaechliche SQL-Funktion
 * public.apply_payroll_run_calculation (Migration 20260821125833_...)
 * gegen eine frisch migrierte Postgres-Instanz aus — inklusive echter
 * Trigger und echter RLS-Policies.
 *
 * Sie ersetzen NICHT die bestehenden In-Memory-Tests
 * (src/lib/payroll-run-atomicity.test.ts), sondern ergaenzen sie.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { PGlite } from "@electric-sql/pglite";
import {
  createMigratedTestDatabase,
  migrationFiles,
  useAuthenticatedUser,
  useServiceRole,
} from "../support/sql-test-database";

const FINANZ_USER = "11111111-1111-4111-8111-111111111111";
const ADMIN_USER = "22222222-2222-4222-8222-222222222222";
const FAHRER_USER = "33333333-3333-4333-8333-333333333333";
const DRIVER_ID = "44444444-4444-4444-8444-444444444444";
const RUN_ID = "55555555-5555-4555-8555-555555555555";

type RunRow = {
  status: string;
  brutto: string | number | null;
  netto: string | number | null;
  summe_abzuege: string | number | null;
  summe_arbeitgeberkosten: string | number | null;
  stunden: string | number | null;
  version: number;
};

type ItemRow = {
  regel_kennung: string;
  kategorie: string;
  betrag: string | number;
};

const num = (v: string | number | null): number | null => (v === null ? null : Number(v));

function itemsJson(entries: Array<{ kennung: string; kategorie: string; betrag: number }>): string {
  return JSON.stringify(
    entries.map((e) => ({
      rule_id: null,
      regel_kennung: e.kennung,
      regel_bezeichnung: e.kennung,
      kategorie: e.kategorie,
      berechnungsart: "prozent",
      prozentsatz: null,
      festbetrag: null,
      basisbetrag: 2000,
      betrag: e.betrag,
      quelle: "Testquelle",
      quelle_version: "2026",
    })),
  );
}

const applyCall = `select public.apply_payroll_run_calculation(
    $1::uuid, $2::jsonb, $3::text, null::uuid, 'stundenlohn'::text,
    $4::numeric, 15::numeric, $5::numeric, $6::numeric, $7::numeric, $8::numeric, '[]'::jsonb
  );`;

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedTestDatabase();

  // Seed als privilegierter Kontext (kein auth.uid()) – entspricht service_role.
  await useServiceRole(db);
  await db.query(
    `insert into auth.users (id, email) values ($1,'finanz@test.local'),($2,'admin@test.local'),($3,'fahrer@test.local');`,
    [FINANZ_USER, ADMIN_USER, FAHRER_USER],
  );
  await db.query(
    `insert into public.user_roles (user_id, role) values ($1,'finanz'),($2,'admin'),($3,'fahrer');`,
    [FINANZ_USER, ADMIN_USER, FAHRER_USER],
  );
  await db.query(
    `insert into public.drivers (id, nummer, name, user_id) values ($1,'F-001','Testfahrer',$2);`,
    [DRIVER_ID, FAHRER_USER],
  );
  await db.query(
    `insert into public.payroll_runs (id, driver_id, periode_monat) values ($1,$2,'2026-07-01');`,
    [RUN_ID, DRIVER_ID],
  );
  // Ausgangsstand: berechnet, mit einem vorhandenen Posten.
  await db.query(
    `update public.payroll_runs set status='berechnet', verguetungsart='stundenlohn',
       stunden=100, stundenlohn=15, brutto=1500, summe_abzuege=300, netto=1200,
       summe_arbeitgeberkosten=350, berechnet_von=$2 where id=$1;`,
    [RUN_ID, FINANZ_USER],
  );
  await db.query(
    `insert into public.payroll_run_items (run_id, regel_kennung, regel_bezeichnung, kategorie,
       berechnungsart, basisbetrag, betrag, quelle, quelle_version)
     values ($1,'ALT_LSt','Alte Lohnsteuer','arbeitnehmerabzug','prozent',1500,300,'Altquelle','2025');`,
    [RUN_ID],
  );
});

afterAll(async () => {
  await db?.close();
});

describe("SQL-Runtime: Migrationsintegritaet", () => {
  test("alle Migrationen laufen sequenziell fehlerfrei gegen PGlite", () => {
    // createMigratedTestDatabase() wirft bei jedem Migrationsfehler.
    expect(migrationFiles.length).toBeGreaterThanOrEqual(63);
  });
});

describe("SQL-Runtime: apply_payroll_run_calculation", () => {
  test("Erfolgsfall: Posten und Kopf zeigen konsistent den neuen Stand", async () => {
    await useAuthenticatedUser(db, FINANZ_USER);

    await db.query(applyCall, [
      RUN_ID,
      itemsJson([
        { kennung: "LSt", kategorie: "arbeitnehmerabzug", betrag: 400 },
        { kennung: "KV", kategorie: "arbeitnehmerabzug", betrag: 160 },
        { kennung: "AG_KV", kategorie: "arbeitgeberkosten", betrag: 160 },
      ]),
      "berechnet",
      120,
      2000,
      560,
      1440,
      420,
    ]);

    const run = await db.query<RunRow>(
      `select status, brutto, netto, summe_abzuege, summe_arbeitgeberkosten, stunden, version
         from public.payroll_runs where id = $1;`,
      [RUN_ID],
    );
    expect(run.rows).toHaveLength(1);
    expect(run.rows[0]!.status).toBe("berechnet");
    expect(num(run.rows[0]!.brutto)).toBe(2000);
    expect(num(run.rows[0]!.summe_abzuege)).toBe(560);
    expect(num(run.rows[0]!.netto)).toBe(1440);
    expect(num(run.rows[0]!.summe_arbeitgeberkosten)).toBe(420);
    expect(num(run.rows[0]!.stunden)).toBe(120);

    const items = await db.query<ItemRow>(
      `select regel_kennung, kategorie, betrag from public.payroll_run_items
         where run_id = $1 order by regel_kennung;`,
      [RUN_ID],
    );
    expect(items.rows.map((r) => r.regel_kennung)).toEqual(["AG_KV", "KV", "LSt"]);
    // Der alte Posten wurde im selben Aufruf entfernt.
    expect(items.rows.some((r) => r.regel_kennung === "ALT_LSt")).toBe(false);
    expect(items.rows.map((r) => num(r.betrag))).toEqual([160, 160, 400]);
  });

  test("Fehlerfall: freigegebener Lauf bricht ab, Posten und Kopf bleiben unveraendert", async () => {
    // Echter Vier-Augen-Weg zum Status 'freigegeben'.
    await useAuthenticatedUser(db, FINANZ_USER);
    await db.query(`update public.payroll_runs set status='zur_freigabe' where id=$1;`, [RUN_ID]);
    await useAuthenticatedUser(db, ADMIN_USER);
    await db.query(`update public.payroll_runs set status='freigegeben' where id=$1;`, [RUN_ID]);

    const before = await db.query<RunRow>(
      `select status, brutto, netto, summe_abzuege, summe_arbeitgeberkosten, stunden, version
         from public.payroll_runs where id=$1;`,
      [RUN_ID],
    );
    const itemsBefore = await db.query<ItemRow>(
      `select regel_kennung, kategorie, betrag from public.payroll_run_items
         where run_id=$1 order by regel_kennung;`,
      [RUN_ID],
    );
    expect(before.rows[0]!.status).toBe("freigegeben");
    expect(itemsBefore.rows).toHaveLength(3);

    let message = "";
    try {
      await db.query(applyCall, [
        RUN_ID,
        itemsJson([{ kennung: "NEU", kategorie: "arbeitnehmerabzug", betrag: 999 }]),
        "berechnet",
        1,
        1,
        1,
        1,
        1,
      ]);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("freigegebener Lohnlauf ist unveraenderlich");

    const after = await db.query<RunRow>(
      `select status, brutto, netto, summe_abzuege, summe_arbeitgeberkosten, stunden, version
         from public.payroll_runs where id=$1;`,
      [RUN_ID],
    );
    const itemsAfter = await db.query<ItemRow>(
      `select regel_kennung, kategorie, betrag from public.payroll_run_items
         where run_id=$1 order by regel_kennung;`,
      [RUN_ID],
    );
    // Echter Transaktions-Rollback: kein DELETE, kein INSERT, kein UPDATE.
    expect(after.rows[0]).toEqual(before.rows[0]!);
    expect(itemsAfter.rows).toEqual(itemsBefore.rows);
  });
});

describe("SQL-Runtime: RLS fuer Lohnlaeufe", () => {
  test("Fahrer sieht keine Lohnlaeufe und darf die RPC nicht wirksam nutzen", async () => {
    await useAuthenticatedUser(db, FAHRER_USER);

    const runs = await db.query(`select * from public.payroll_runs;`);
    expect(runs.rows).toHaveLength(0);

    const items = await db.query(`select * from public.payroll_run_items;`);
    expect(items.rows).toHaveLength(0);

    let message = "";
    try {
      await db.query(applyCall, [
        RUN_ID,
        itemsJson([{ kennung: "HACK", kategorie: "arbeitnehmerabzug", betrag: 1 }]),
        "berechnet",
        1,
        1,
        1,
        1,
        1,
      ]);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    // Der Lauf ist fuer den Fahrer wegen RLS unsichtbar -> Funktion bricht ab.
    expect(message).toContain("Lohnlauf nicht gefunden");

    // Beweis, dass nichts geaendert wurde: privilegiert nachlesen.
    await useServiceRole(db);
    const itemsAfter = await db.query<ItemRow>(
      `select regel_kennung from public.payroll_run_items where run_id=$1;`,
      [RUN_ID],
    );
    expect(itemsAfter.rows.some((r) => r.regel_kennung === "HACK")).toBe(false);
    expect(itemsAfter.rows).toHaveLength(3);
  });
});
