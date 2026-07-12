-- ============================================================
-- GHASI AI – Sicherheits-Härtung: Gedächtnis-Ownership & KI-Audit
-- ============================================================

-- ---------- P3: GHASI Memory – Ownership & typisierte Erinnerungen ----------
ALTER TABLE public.ghasi_memory
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS typ text NOT NULL DEFAULT 'observation',
  ADD COLUMN IF NOT EXISTS genehmigt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Erlaubte Erinnerungstypen erzwingen.
ALTER TABLE public.ghasi_memory DROP CONSTRAINT IF EXISTS ghasi_memory_typ_check;
ALTER TABLE public.ghasi_memory
  ADD CONSTRAINT ghasi_memory_typ_check
  CHECK (typ IN ('personal','company_rule','professional_correction','temporary','observation'));

-- Bestehende (verwaiste) Alt-Erinnerung als generische Beobachtung ohne Besitzer belassen.
UPDATE public.ghasi_memory SET typ = 'observation' WHERE typ IS NULL;

-- RLS für ghasi_memory neu ordnen: jeder sieht nur eigene Erinnerungen
-- plus admin-freigegebene Unternehmensregeln; Admins sehen alles.
DROP POLICY IF EXISTS "Nur Admins lesen Memory" ON public.ghasi_memory;
DROP POLICY IF EXISTS "Nutzer lesen eigene und freigegebene Memory" ON public.ghasi_memory;
CREATE POLICY "Nutzer lesen eigene und freigegebene Memory"
  ON public.ghasi_memory
  FOR SELECT
  TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR user_id = auth.uid()
    OR (typ = 'company_rule' AND genehmigt = true)
  );

-- Schreiben/Ändern/Löschen erfolgt ausschließlich serverseitig (Service-Role);
-- keine direkten Client-Policies für INSERT/UPDATE/DELETE.

-- ---------- P6: KI-Audit – keine Roh-Prompts/Antworten speichern ----------
-- Rohe Nutzerfrage entfernen (redigiert bestehende Datensätze + verhindert künftige Speicherung).
ALTER TABLE public.ai_audit_log DROP COLUMN IF EXISTS frage;

-- Nur Metadaten ergänzen.
ALTER TABLE public.ai_audit_log
  ADD COLUMN IF NOT EXISTS werkzeuge text[],
  ADD COLUMN IF NOT EXISTS dauer_ms integer,
  ADD COLUMN IF NOT EXISTS erfolg boolean NOT NULL DEFAULT true;