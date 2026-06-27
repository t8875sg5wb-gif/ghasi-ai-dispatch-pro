CREATE TABLE public.drivers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nummer text NOT NULL,
  name text NOT NULL DEFAULT '',
  foto text,
  telefon text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  adresse text NOT NULL DEFAULT '',
  fuehrerschein jsonb NOT NULL DEFAULT '{}'::jsonb,
  p_schein jsonb NOT NULL DEFAULT '{}'::jsonb,
  erste_hilfe jsonb NOT NULL DEFAULT '{}'::jsonb,
  vertragsart text NOT NULL DEFAULT 'Vollzeit',
  arbeitszeiten text NOT NULL DEFAULT '',
  urlaubstage integer NOT NULL DEFAULT 0,
  krankheitstage integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'verfuegbar',
  standort text NOT NULL DEFAULT '',
  gps jsonb NOT NULL DEFAULT '{}'::jsonb,
  fahrzeug text,
  schicht text NOT NULL DEFAULT '',
  bewertung numeric NOT NULL DEFAULT 0,
  puenktlichkeit integer NOT NULL DEFAULT 0,
  beschwerden integer NOT NULL DEFAULT 0,
  lob integer NOT NULL DEFAULT 0,
  ueberstunden numeric NOT NULL DEFAULT 0,
  km_heute numeric NOT NULL DEFAULT 0,
  umsatz_heute numeric NOT NULL DEFAULT 0,
  gewinn_heute numeric NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Angemeldete sehen Fahrer"
  ON public.drivers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Disposition legt Fahrer an"
  ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'disposition'));

CREATE POLICY "Disposition und Fahrer aendern Fahrer"
  ON public.drivers FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'disposition')
    OR public.has_role(auth.uid(), 'fahrer')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'disposition')
    OR public.has_role(auth.uid(), 'fahrer')
  );

CREATE POLICY "Disposition loescht Fahrer"
  ON public.drivers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'disposition'));

CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_drivers_status ON public.drivers(status);
CREATE INDEX idx_drivers_nummer ON public.drivers(nummer);