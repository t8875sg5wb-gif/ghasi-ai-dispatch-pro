ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS ablehnungsquote_schwelle_prozent integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS ablehnungsquote_min_versuche integer NOT NULL DEFAULT 5;

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_ablehnungsquote_schwelle_check;
ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_ablehnungsquote_schwelle_check
  CHECK (ablehnungsquote_schwelle_prozent BETWEEN 1 AND 100);

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_ablehnungsquote_min_versuche_check;
ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_ablehnungsquote_min_versuche_check
  CHECK (ablehnungsquote_min_versuche BETWEEN 1 AND 1000);