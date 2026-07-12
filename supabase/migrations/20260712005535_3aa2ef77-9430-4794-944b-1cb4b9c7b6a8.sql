ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS betriebskosten_dieselpreis numeric NOT NULL DEFAULT 1.75,
  ADD COLUMN IF NOT EXISTS betriebskosten_arbeitstage integer NOT NULL DEFAULT 21;