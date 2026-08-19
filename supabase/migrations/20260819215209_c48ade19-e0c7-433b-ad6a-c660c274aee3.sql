ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS adresse_strasse text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adresse_hausnummer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adresse_plz text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adresse_ort text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adresse_land text NOT NULL DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS iban text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS xrechnung_daten_bestaetigt boolean NOT NULL DEFAULT false;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS adresse_strasse text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adresse_hausnummer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adresse_plz text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adresse_ort text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adresse_land text NOT NULL DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS leitweg_id text NOT NULL DEFAULT '';