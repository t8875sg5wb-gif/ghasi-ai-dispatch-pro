CREATE TABLE public.verordnungen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  ausstellungsdatum date NOT NULL,
  arzt_name text NOT NULL DEFAULT '',
  arzt_bsnr text NOT NULL DEFAULT '',
  arzt_lanr text NOT NULL DEFAULT '',
  transportart text NOT NULL,
  hin_rueckfahrt boolean NOT NULL DEFAULT false,
  ist_serie boolean NOT NULL DEFAULT false,
  anzahl_faelligkeiten integer,
  seriengueltig_von date,
  seriengueltig_bis date,
  genehmigt_von_kasse boolean NOT NULL DEFAULT false,
  genehmigungsnummer text NOT NULL DEFAULT '',
  dokument_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  notiz text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.verordnungen TO authenticated;
GRANT ALL ON public.verordnungen TO service_role;

ALTER TABLE public.verordnungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Berechtigte sehen Verordnungen" ON public.verordnungen
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'fahrer'::app_role));

CREATE POLICY "Disposition legt Verordnungen an" ON public.verordnungen
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

CREATE POLICY "Disposition aendert Verordnungen" ON public.verordnungen
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

CREATE POLICY "Disposition loescht Verordnungen" ON public.verordnungen
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

CREATE TRIGGER update_verordnungen_updated_at
  BEFORE UPDATE ON public.verordnungen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_verordnungen_patient ON public.verordnungen(patient_id);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS verordnung_id uuid REFERENCES public.verordnungen(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_verordnung ON public.orders(verordnung_id);