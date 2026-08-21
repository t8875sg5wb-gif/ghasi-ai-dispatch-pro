import { createMigratedTestDatabase } from "../support/sql-test-database";
const db = await createMigratedTestDatabase();
for (const t of ["payroll_runs","payroll_run_items","user_roles","drivers","employment_relationships","profiles"]) {
  const r = await db.query<any>(`select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`,[t]);
  console.log("=== "+t);
  console.log(r.rows.map(c=>`${c.column_name} ${c.data_type} ${c.is_nullable} ${c.column_default??''}`).join("\n"));
}
const p = await db.query<any>(`select tablename,policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' and tablename in ('payroll_runs','payroll_run_items','user_roles')`);
console.log("=== policies"); for(const x of p.rows) console.log(JSON.stringify(x));
const f = await db.query<any>(`select p.proname, n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like '%has_role%' or p.proname like '%payroll%'`);
console.log("=== funcs"); for(const x of f.rows) console.log(x.nspname+"."+x.proname);
await db.close();
