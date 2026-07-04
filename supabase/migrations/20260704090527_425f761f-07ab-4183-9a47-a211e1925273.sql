CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton integer NOT NULL DEFAULT 1 UNIQUE,
  firma text NOT NULL DEFAULT '',
  rechtsform text NOT NULL DEFAULT 'Einzelunternehmen',
  inhaber text NOT NULL DEFAULT '',
  adresse text NOT NULL DEFAULT '',
  telefon text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  steuernummer text NOT NULL DEFAULT '',
  ust_id text NOT NULL DEFAULT '',
  gewerbesteuer_hebesatz numeric NOT NULL DEFAULT 460,
  steuer_modus text NOT NULL DEFAULT 'befreit_4_17b',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read company settings"
  ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert company settings"
  ON public.company_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update company settings"
  ON public.company_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();