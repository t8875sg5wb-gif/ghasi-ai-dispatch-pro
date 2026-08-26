import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");

export const migrationFiles = readdirSync(migrationDirectory)
  .filter((n) => n.endsWith(".sql"))
  .sort();

/**
 * Grundelemente, die Supabase real bereitstellt und die unsere Migrationen
 * voraussetzen: RLS-Rollen, auth-Schema mit auth.uid()/auth.jwt(),
 * storage-Schema, private-Schema-Hilfen.
 */
const bootstrapSql = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create role supabase_auth_admin nologin;
  create schema extensions;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  create or replace function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '');
  $$;
  create or replace function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  $$;
  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text,
    owner uuid,
    metadata jsonb
  );
  alter table storage.objects enable row level security;
  grant usage on schema auth, storage, extensions to anon, authenticated, service_role;
  -- pg_cron ist in PGlite nicht verfügbar. Wir stellen die von Migrationen
  -- genutzte Oberfläche nachgebildet bereit, damit Zeitplan-Migrationen
  -- durchlaufen. Die Ausführung selbst wird bewusst nicht simuliert.
  create schema cron;
  create table cron.job (
    jobid bigserial primary key,
    jobname text unique,
    schedule text,
    command text
  );
  create or replace function cron.schedule(job_name text, schedule text, command text)
  returns bigint language sql as $$
    insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
    on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
    returning jobid;
  $$;
  create or replace function cron.unschedule(job_name text)
  returns boolean language sql as $$
    delete from cron.job where jobname = job_name returning true;
  $$;
`;

/** In PGlite nicht installierbare Extensions werden für den Test entfernt. */
function fuerTestVorbereiten(sql: string): string {
  return sql.replace(/CREATE\s+EXTENSION[^;]*pg_(cron|net)[^;]*;/gi, "");
}

export type MigrationResult = {
  file: string;
  ok: boolean;
  error?: string;
};

export async function runMigrations(db: PGlite): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationDirectory, file), "utf8");
    try {
      await db.exec(sql);
      results.push({ file, ok: true });
    } catch (error) {
      results.push({
        file,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

export async function createMigratedTestDatabase(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto, btree_gist, uuid_ossp } });
  await db.exec(bootstrapSql);
  const results = await runMigrations(db);
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    const detail = failed.map((f) => `${f.file}: ${f.error}`).join("\n");
    await db.close();
    throw new Error(`Migrationen fehlgeschlagen:\n${detail}`);
  }
  return db;
}

export async function useAuthenticatedUser(db: PGlite, userId: string): Promise<void> {
  await db.exec("set role authenticated;");
  await db.query("select set_config($1, $2, false);", ["request.jwt.claim.sub", userId]);
  await db.query("select set_config($1, $2, false);", ["request.jwt.claim.role", "authenticated"]);
  await db.query("select set_config($1, $2, false);", [
    "request.jwt.claims",
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
}

export async function useServiceRole(db: PGlite): Promise<void> {
  await db.exec("reset role;");
  await db.query("select set_config($1, $2, false);", ["request.jwt.claim.sub", ""]);
  await db.query("select set_config($1, $2, false);", ["request.jwt.claim.role", "service_role"]);
  await db.query("select set_config($1, $2, false);", [
    "request.jwt.claims",
    JSON.stringify({ role: "service_role" }),
  ]);
}
