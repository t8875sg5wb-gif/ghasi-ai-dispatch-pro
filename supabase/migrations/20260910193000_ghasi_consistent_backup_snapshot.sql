-- Konsistenter GHASI-Backup-Snapshot: alle public-Tabellen in einem DB-Statement.
CREATE OR REPLACE FUNCTION public.ghasi_backup_snapshot()
RETURNS TABLE(table_name text, rows jsonb, row_count bigint, snapshot_id text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_snapshot text := txid_current_snapshot()::text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Backup-Snapshot ist Administratoren vorbehalten.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.table_name, s.rows, jsonb_array_length(s.rows)::bigint, v_snapshot
  FROM (
    SELECT 'drivers'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."drivers" x
    UNION ALL
    SELECT 'vehicles'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."vehicles" x
    UNION ALL
    SELECT 'customers'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."customers" x
    UNION ALL
    SELECT 'patients'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."patients" x
    UNION ALL
    SELECT 'facilities'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."facilities" x
    UNION ALL
    SELECT 'insurers'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."insurers" x
    UNION ALL
    SELECT 'orders'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."orders" x
    UNION ALL
    SELECT 'recurring_orders'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."recurring_orders" x
    UNION ALL
    SELECT 'recurring_rejections'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."recurring_rejections" x
    UNION ALL
    SELECT 'driver_shifts'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."driver_shifts" x
    UNION ALL
    SELECT 'vehicle_trips'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."vehicle_trips" x
    UNION ALL
    SELECT 'employment_relationships'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."employment_relationships" x
    UNION ALL
    SELECT 'payroll_facts'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."payroll_facts" x
    UNION ALL
    SELECT 'payroll_rules'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."payroll_rules" x
    UNION ALL
    SELECT 'payroll_runs'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."payroll_runs" x
    UNION ALL
    SELECT 'payroll_run_items'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."payroll_run_items" x
    UNION ALL
    SELECT 'invoices'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."invoices" x
    UNION ALL
    SELECT 'expenses'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."expenses" x
    UNION ALL
    SELECT 'insurance_policies'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."insurance_policies" x
    UNION ALL
    SELECT 'insurer_contracts'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."insurer_contracts" x
    UNION ALL
    SELECT 'leasing_contracts'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."leasing_contracts" x
    UNION ALL
    SELECT 'verordnungen'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."verordnungen" x
    UNION ALL
    SELECT 'documents'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."documents" x
    UNION ALL
    SELECT 'document_cleanup_jobs'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."document_cleanup_jobs" x
    UNION ALL
    SELECT 'calls'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."calls" x
    UNION ALL
    SELECT 'conversations'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."conversations" x
    UNION ALL
    SELECT 'communication_drafts'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."communication_drafts" x
    UNION ALL
    SELECT 'chat_threads'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."chat_threads" x
    UNION ALL
    SELECT 'chat_messages'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."chat_messages" x
    UNION ALL
    SELECT 'company_settings'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."company_settings" x
    UNION ALL
    SELECT 'automation_states'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."automation_states" x
    UNION ALL
    SELECT 'profiles'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."profiles" x
    UNION ALL
    SELECT 'user_roles'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."user_roles" x
    UNION ALL
    SELECT 'ghasi_memory'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."ghasi_memory" x
    UNION ALL
    SELECT 'activity_log'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."activity_log" x
    UNION ALL
    SELECT 'ai_audit_log'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."ai_audit_log" x
    UNION ALL
    SELECT 'ai_audit_log_archive'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."ai_audit_log_archive" x
    UNION ALL
    SELECT 'employment_audit_log'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."employment_audit_log" x
    UNION ALL
    SELECT 'invoice_audit_snapshots'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."invoice_audit_snapshots" x
    UNION ALL
    SELECT 'invoice_changes'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."invoice_changes" x
    UNION ALL
    SELECT 'payroll_fact_audit_log'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."payroll_fact_audit_log" x
    UNION ALL
    SELECT 'payroll_rule_audit_log'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."payroll_rule_audit_log" x
    UNION ALL
    SELECT 'payroll_run_audit_log'::text AS table_name, COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb) AS rows FROM public."payroll_run_audit_log" x
  ) AS s;
END;
$$;

REVOKE ALL ON FUNCTION public.ghasi_backup_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghasi_backup_snapshot() FROM anon;
GRANT EXECUTE ON FUNCTION public.ghasi_backup_snapshot() TO authenticated;
