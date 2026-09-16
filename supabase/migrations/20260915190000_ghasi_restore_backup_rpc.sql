-- Atomarer GHASI-Datenbank-Restore fuer validierte Backup-Daten.
-- Die Funktion ist absichtlich Admin-only und nimmt niemals Storage-Dateien entgegen.
CREATE OR REPLACE FUNCTION public.ghasi_restore_backup(
  p_data jsonb,
  p_row_counts jsonb
)
RETURNS TABLE(table_count integer, total_rows bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_tables text[] := ARRAY[
    'drivers','vehicles','customers','facilities','insurers','recurring_rejections',
    'payroll_rules','invoices','insurance_policies','leasing_contracts','documents',
    'document_cleanup_jobs','calls','conversations','communication_drafts','chat_threads',
    'company_settings','automation_states','profiles','user_roles','ghasi_memory',
    'activity_log','ai_audit_log','ai_audit_log_archive','employment_audit_log',
    'payroll_fact_audit_log','payroll_rule_audit_log','payroll_run_audit_log',
    'driver_shifts','employment_relationships','payroll_facts','vehicle_trips',
    'insurer_contracts','invoice_changes','invoice_audit_snapshots','patients','expenses',
    'chat_messages','payroll_runs','recurring_orders','verordnungen','payroll_run_items','orders'
  ];
  v_replay_last text[] := ARRAY[
    'activity_log','ai_audit_log','ai_audit_log_archive','employment_audit_log',
    'invoice_audit_snapshots','invoice_changes','payroll_fact_audit_log',
    'payroll_rule_audit_log','payroll_run_audit_log'
  ];  v_expected_keys text[];
  v_actual_keys text[];
  v_columns text[];
  v_table text;
  v_row jsonb;
  v_sql text;
  v_count bigint;
  v_expected bigint;
  v_total bigint := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Restore ist Administratoren vorbehalten.' USING ERRCODE = '42501';
  END IF;

  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'Restore-Daten haben kein gueltiges Objektformat.';
  END IF;
  IF p_row_counts IS NULL OR jsonb_typeof(p_row_counts) <> 'object' THEN
    RAISE EXCEPTION 'Restore-Zeilenzaehler haben kein gueltiges Objektformat.';
  END IF;

  SELECT array_agg(x ORDER BY x) INTO v_expected_keys FROM unnest(v_tables) AS x;
  SELECT array_agg(key ORDER BY key) INTO v_actual_keys FROM jsonb_object_keys(p_data) AS key;
  IF v_actual_keys IS DISTINCT FROM v_expected_keys THEN
    RAISE EXCEPTION 'Restore-Daten enthalten fehlende oder unbekannte Tabellen.';
  END IF;  SELECT array_agg(key ORDER BY key) INTO v_actual_keys FROM jsonb_object_keys(p_row_counts) AS key;
  IF v_actual_keys IS DISTINCT FROM v_expected_keys THEN
    RAISE EXCEPTION 'Restore-Zeilenzaehler enthalten fehlende oder unbekannte Tabellen.';
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    IF jsonb_typeof(p_data -> v_table) <> 'array' THEN
      RAISE EXCEPTION 'Restore-Tabelle % hat kein Arrayformat.', v_table;
    END IF;
    IF jsonb_typeof(p_row_counts -> v_table) <> 'number' THEN
      RAISE EXCEPTION 'Restore-Zeilenzaehler fuer % ist ungueltig.', v_table;
    END IF;
    v_expected := (p_row_counts ->> v_table)::bigint;
    IF v_expected < 0 OR jsonb_array_length(p_data -> v_table) <> v_expected THEN
      RAISE EXCEPTION 'Restore-Zeilenzaehler fuer % stimmt nicht.', v_table;
    END IF;
    v_total := v_total + v_expected;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = v_table
        AND (c.is_generated <> 'NEVER' OR c.is_identity = 'YES')
    ) THEN
      RAISE EXCEPTION 'Restore unterstuetzt generierte/Identity-Spalten in % nicht.', v_table;
    END IF;    SELECT array_agg(c.column_name ORDER BY c.column_name)
      INTO v_columns
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = v_table;
    IF v_columns IS NULL THEN
      RAISE EXCEPTION 'Restore-Schema fuer % fehlt.', v_table;
    END IF;

    FOR v_row IN SELECT value FROM jsonb_array_elements(p_data -> v_table) LOOP
      IF jsonb_typeof(v_row) <> 'object' THEN
        RAISE EXCEPTION 'Restore-Zeile in % ist kein Objekt.', v_table;
      END IF;
      SELECT array_agg(key ORDER BY key)
        INTO v_actual_keys
      FROM jsonb_object_keys(v_row) AS key;
      IF v_actual_keys IS DISTINCT FROM v_columns THEN
        RAISE EXCEPTION 'Restore-Spalten von % passen nicht zum aktuellen Schema.', v_table;
      END IF;
    END LOOP;
  END LOOP;

  SELECT string_agg(format('public.%I', x), ', ')
    INTO v_sql
  FROM unnest(v_tables) AS x;
  EXECUTE 'TRUNCATE TABLE ' || v_sql;  FOREACH v_table IN ARRAY v_tables LOOP
    IF NOT (v_table = ANY(v_replay_last)) THEN
      EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1)',
        v_table, v_table
      ) USING p_data -> v_table;
    END IF;
  END LOOP;

  SELECT string_agg(format('public.%I', x), ', ')
    INTO v_sql
  FROM unnest(v_replay_last) AS x;
  EXECUTE 'TRUNCATE TABLE ' || v_sql;

  FOREACH v_table IN ARRAY v_tables LOOP
    IF v_table = ANY(v_replay_last) THEN
      EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1)',
        v_table, v_table
      ) USING p_data -> v_table;
    END IF;
  END LOOP;

  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_table) INTO v_count;
    v_expected := (p_row_counts ->> v_table)::bigint;    IF v_count <> v_expected THEN
      RAISE EXCEPTION 'Restore-Zeilenzahl von % ist %, erwartet %.', v_table, v_count, v_expected;
    END IF;
  END LOOP;

  RETURN QUERY SELECT cardinality(v_tables), v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.ghasi_restore_backup(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghasi_restore_backup(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.ghasi_restore_backup(jsonb, jsonb) TO authenticated;
