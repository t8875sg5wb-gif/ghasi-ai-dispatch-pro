import { createMigratedTestDatabase } from "../support/sql-test-database";
const db = await createMigratedTestDatabase();
console.log((await db.query<any>(`select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='app_role'`)).rows.map(r=>r.enumlabel).join(","));
console.log((await db.query<any>(`select tgname, relname from pg_trigger tg join pg_class c on c.oid=tg.tgrelid where relname like 'payroll%' and not tgisinternal`)).rows.map(r=>r.relname+":"+r.tgname).join("\n"));
await db.close();
