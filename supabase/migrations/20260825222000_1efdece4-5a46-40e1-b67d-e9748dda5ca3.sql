ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS mcp_audit_retention_months integer NOT NULL DEFAULT 12;

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_mcp_retention_check;
ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_mcp_retention_check
  CHECK (mcp_audit_retention_months BETWEEN 1 AND 120);

CREATE TABLE IF NOT EXISTS public.ai_audit_log_archive (
  id uuid NOT NULL PRIMARY KEY,
  user_id uuid,
  rolle text,
  quellen jsonb,
  vorbereitete_aktionen jsonb,
  modell text,
  thread_id uuid,
  werkzeuge text[],
  dauer_ms integer,
  erfolg boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL,
  archiviert_am timestamp with time zone NOT NULL DEFAULT now(),
  archiv_frist_monate integer NOT NULL
);

GRANT SELECT ON public.ai_audit_log_archive TO authenticated;
GRANT ALL ON public.ai_audit_log_archive TO service_role;

ALTER TABLE public.ai_audit_log_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins sehen das Audit-Archiv" ON public.ai_audit_log_archive;
CREATE POLICY "Admins sehen das Audit-Archiv"
  ON public.ai_audit_log_archive
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS ai_audit_log_archive_created_at_idx
  ON public.ai_audit_log_archive (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_audit_log_archive_modell_idx
  ON public.ai_audit_log_archive (modell);

CREATE OR REPLACE FUNCTION public.archive_mcp_audit_logs(p_monate integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_monate integer := LEAST(120, GREATEST(1, COALESCE(p_monate, 12)));
  v_stichtag timestamptz := now() - (v_monate || ' months')::interval;
  v_anzahl integer := 0;
BEGIN
  WITH verschoben AS (
    DELETE FROM public.ai_audit_log
    WHERE modell = 'mcp'
      AND created_at < v_stichtag
    RETURNING *
  )
  INSERT INTO public.ai_audit_log_archive (
    id, user_id, rolle, quellen, vorbereitete_aktionen, modell, thread_id,
    werkzeuge, dauer_ms, erfolg, created_at, archiv_frist_monate
  )
  SELECT v.id, v.user_id, v.rolle, v.quellen, v.vorbereitete_aktionen, v.modell, v.thread_id,
         v.werkzeuge, v.dauer_ms, v.erfolg, v.created_at, v_monate
  FROM verschoben v
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_anzahl = ROW_COUNT;
  RETURN v_anzahl;
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_mcp_audit_logs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_mcp_audit_logs(integer) TO service_role;