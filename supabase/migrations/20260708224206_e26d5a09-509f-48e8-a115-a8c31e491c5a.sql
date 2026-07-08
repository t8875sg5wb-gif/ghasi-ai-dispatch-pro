-- Priority 4: driver employment type & monthly gross for the Lohn-Rechner
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS beschaeftigungsart TEXT NOT NULL DEFAULT 'minijob',
  ADD COLUMN IF NOT EXISTS monatsbrutto NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Priority 6: recorded payments (partial payments allowed) on invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS zahlungen JSONB NOT NULL DEFAULT '[]'::jsonb;