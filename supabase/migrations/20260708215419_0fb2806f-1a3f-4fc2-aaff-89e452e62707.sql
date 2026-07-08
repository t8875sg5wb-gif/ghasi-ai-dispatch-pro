-- ============================================================
-- Priority 2/3/11: column additions to existing tables
-- ============================================================

-- Patients: billing & compliance fields
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS kostentraeger_id UUID REFERENCES public.insurers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS versichertennummer TEXT,
  ADD COLUMN IF NOT EXISTS zuzahlungsbefreit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS zuzahlungsbefreit_bis DATE,
  ADD COLUMN IF NOT EXISTS verordnung_vorhanden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verordnung_dokument_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS genehmigung_bis DATE;

-- Company settings: Institutionskennzeichen for §133 SGB V billing
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS ik_nummer TEXT;

-- Drivers: compliance fields feeding the compliance cockpit
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS p_schein_gueltig_bis DATE,
  ADD COLUMN IF NOT EXISTS fuehrungszeugnis_datum DATE,
  ADD COLUMN IF NOT EXISTS sv_ausweis_vorhanden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS steuer_id TEXT;

-- Invoices: Leistungsdatum (service date) for §14 UStG compliant invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS leistungsdatum DATE;

-- Vehicles: real GPS position from the driver mobile view (opt-in)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS real_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS real_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS real_gps_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- Priority 4: expenses (Ausgaben) with receipt photos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  datum DATE NOT NULL DEFAULT CURRENT_DATE,
  kategorie TEXT NOT NULL DEFAULT 'Sonstiges',
  lieferant TEXT NOT NULL DEFAULT '',
  betrag_brutto NUMERIC(12,2) NOT NULL DEFAULT 0,
  ust_satz NUMERIC(5,2) NOT NULL DEFAULT 19,
  fahrzeug_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  fahrer_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  notiz TEXT,
  beleg_dokument_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finanz sieht Ausgaben" ON public.expenses FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanz legt Ausgaben an" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanz aendert Ausgaben" ON public.expenses FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanz loescht Ausgaben" ON public.expenses FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Priority 7: GoBD invoice change log (revisionssicher)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  invoice_nummer TEXT,
  akteur TEXT,
  feld TEXT NOT NULL,
  alt_wert TEXT,
  neu_wert TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.invoice_changes TO authenticated;
GRANT ALL ON public.invoice_changes TO service_role;
ALTER TABLE public.invoice_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finanz sieht Rechnungsaenderungen" ON public.invoice_changes FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanz protokolliert Rechnungsaenderungen" ON public.invoice_changes FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));

CREATE INDEX IF NOT EXISTS idx_invoice_changes_invoice ON public.invoice_changes(invoice_id);