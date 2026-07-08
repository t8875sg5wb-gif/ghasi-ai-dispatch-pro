ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS mahnstufe integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS letzte_mahnung timestamptz,
  ADD COLUMN IF NOT EXISTS mahn_historie jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS datev_berater_nr text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS datev_mandant_nr text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS datev_erloeskonto text NOT NULL DEFAULT '8120',
  ADD COLUMN IF NOT EXISTS datev_gegenkonto text NOT NULL DEFAULT '10000';