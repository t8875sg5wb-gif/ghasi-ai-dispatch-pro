CREATE TABLE public.insurer_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_id UUID NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
  leistung TEXT NOT NULL DEFAULT '',
  preis NUMERIC NOT NULL DEFAULT 0,
  einheit TEXT NOT NULL DEFAULT 'pro Fahrt',
  genehmigt BOOLEAN NOT NULL DEFAULT false,
  gueltig_ab DATE,
  gueltig_bis DATE,
  aktenzeichen TEXT NOT NULL DEFAULT '',
  notiz TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_contracts TO authenticated;
GRANT ALL ON public.insurer_contracts TO service_role;
ALTER TABLE public.insurer_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Berechtigte sehen Kassenvertraege" ON public.insurer_contracts FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanzen legen Kassenvertraege an" ON public.insurer_contracts FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanzen aendern Kassenvertraege" ON public.insurer_contracts FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Finanzen loeschen Kassenvertraege" ON public.insurer_contracts FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));

CREATE INDEX idx_insurer_contracts_insurer ON public.insurer_contracts (insurer_id);

CREATE TRIGGER update_insurer_contracts_updated_at BEFORE UPDATE ON public.insurer_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();