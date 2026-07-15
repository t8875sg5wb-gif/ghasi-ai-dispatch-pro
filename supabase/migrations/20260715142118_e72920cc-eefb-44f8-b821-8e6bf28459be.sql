-- P0.2 DOCUMENT_SERVER_BOUNDARY
-- RLS allein begrenzt keine Spalten; direkte Browserrechte auf documents
-- werden bewusst gesperrt. Zugriff läuft ab jetzt ausschließlich über
-- serverseitige Endpunkte mit zentralem Rollen-Gate.

-- 1. Alle Table-Grants für Browser-Rollen entziehen.
REVOKE ALL ON public.documents FROM PUBLIC;
REVOKE ALL ON public.documents FROM anon;
REVOKE ALL ON public.documents FROM authenticated;

-- 2. Alle bestehenden Policies auf public.documents entfernen (idempotent).
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.documents', p.policyname);
  END LOOP;
END $$;

-- 3. RLS bleibt zwingend aktiviert – doppelte Sicherung.
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;

-- 4. service_role behält vollen Zugriff für serverseitige Endpunkte.
GRANT ALL ON public.documents TO service_role;

-- 5. Cleanup-Queue für fehlgeschlagene Storage-Rollbacks (server-only).
CREATE TABLE IF NOT EXISTS public.document_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL,
  grund text NOT NULL,
  fehler_code text,
  versuche integer NOT NULL DEFAULT 0,
  letzter_versuch_am timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'document_cleanup_jobs_grund_check'
      AND n.nspname = 'public' AND t.relname = 'document_cleanup_jobs'
  ) THEN
    ALTER TABLE public.document_cleanup_jobs
      ADD CONSTRAINT document_cleanup_jobs_grund_check
      CHECK (grund IN ('upload_metadata_rollback','delete_storage_orphan'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS document_cleanup_jobs_created_idx
  ON public.document_cleanup_jobs (created_at);

REVOKE ALL ON public.document_cleanup_jobs FROM PUBLIC;
REVOKE ALL ON public.document_cleanup_jobs FROM anon;
REVOKE ALL ON public.document_cleanup_jobs FROM authenticated;
GRANT ALL ON public.document_cleanup_jobs TO service_role;

ALTER TABLE public.document_cleanup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_cleanup_jobs FORCE ROW LEVEL SECURITY;
-- Keine Policies: nur service_role (RLS-bypass) darf lesen/schreiben.

-- 6. Bestehenden Status-Check robust auf public.documents scopen.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'documents_status_check'
      AND n.nspname = 'public' AND t.relname = 'documents'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_status_check
      CHECK (status IN ('active','pending_delete'));
  END IF;
END $$;
