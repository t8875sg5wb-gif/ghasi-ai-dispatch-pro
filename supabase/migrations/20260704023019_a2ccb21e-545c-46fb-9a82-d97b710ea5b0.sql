-- ============ insurance_policies ============
CREATE TABLE public.insurance_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versicherer TEXT NOT NULL DEFAULT '',
  policennummer TEXT NOT NULL DEFAULT '',
  art TEXT NOT NULL DEFAULT 'Haftpflicht',
  fahrzeug TEXT NOT NULL DEFAULT '',
  beitrag_monat NUMERIC NOT NULL DEFAULT 0,
  selbstbeteiligung NUMERIC NOT NULL DEFAULT 0,
  beginn TEXT NOT NULL DEFAULT '',
  ablauf TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aktiv',
  notiz TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_policies TO authenticated;
GRANT ALL ON public.insurance_policies TO service_role;
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Berechtigte sehen Versicherungen" ON public.insurance_policies FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanzen legen Versicherungen an" ON public.insurance_policies FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanzen aendern Versicherungen" ON public.insurance_policies FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanzen loeschen Versicherungen" ON public.insurance_policies FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE TRIGGER update_insurance_policies_updated_at BEFORE UPDATE ON public.insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ leasing_contracts ============
CREATE TABLE public.leasing_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  leasinggeber TEXT NOT NULL DEFAULT '',
  vertragsnummer TEXT NOT NULL DEFAULT '',
  fahrzeug TEXT NOT NULL DEFAULT '',
  rate_monat NUMERIC NOT NULL DEFAULT 0,
  beginn TEXT NOT NULL DEFAULT '',
  ende TEXT NOT NULL DEFAULT '',
  restwert NUMERIC NOT NULL DEFAULT 0,
  laufzeit_monate INTEGER NOT NULL DEFAULT 0,
  km_inklusive INTEGER NOT NULL DEFAULT 0,
  km_aktuell INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aktiv',
  notiz TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leasing_contracts TO authenticated;
GRANT ALL ON public.leasing_contracts TO service_role;
ALTER TABLE public.leasing_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Berechtigte sehen Leasing" ON public.leasing_contracts FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanzen legen Leasing an" ON public.leasing_contracts FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanzen aendern Leasing" ON public.leasing_contracts FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanzen loeschen Leasing" ON public.leasing_contracts FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE TRIGGER update_leasing_contracts_updated_at BEFORE UPDATE ON public.leasing_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ calls ============
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  richtung TEXT NOT NULL DEFAULT 'eingehend',
  nummer TEXT NOT NULL DEFAULT '',
  name TEXT,
  zeitpunkt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dauer_sek INTEGER NOT NULL DEFAULT 0,
  kategorie TEXT NOT NULL DEFAULT 'Sonstige',
  status TEXT NOT NULL DEFAULT 'offen',
  notiz TEXT,
  auftrag_erstellt BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Berechtigte sehen Anrufe" ON public.calls FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'fahrer'::app_role));
CREATE POLICY "Disposition legt Anrufe an" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition aendert Anrufe" ON public.calls FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition loescht Anrufe" ON public.calls FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();