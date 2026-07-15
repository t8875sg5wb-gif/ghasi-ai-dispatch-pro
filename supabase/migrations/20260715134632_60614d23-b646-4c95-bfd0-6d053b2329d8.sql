-- P0.1 STORAGE: Persistenter Löschstatus für Dokumente (idempotente Recovery)
-- Ziel: storage.remove-Fehler dürfen kein stiller Erfolg mehr sein.
-- Der Server markiert Dokumente vor dem Storage-Delete als pending_delete
-- und finalisiert den Zustand erst nach nachgewiesenem Storage-Erfolg.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_status_check'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_status_check
      CHECK (status IN ('active','pending_delete'));
  END IF;
END $$;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS delete_attempted_at timestamptz;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS delete_error text;

CREATE INDEX IF NOT EXISTS documents_status_idx ON public.documents (status);
