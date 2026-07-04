
-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  typ TEXT NOT NULL DEFAULT 'Sonstige',
  ansprechpartner TEXT NOT NULL DEFAULT '',
  telefon TEXT NOT NULL DEFAULT '',
  offene_rechnungen INTEGER NOT NULL DEFAULT 0,
  email TEXT,
  adresse TEXT,
  vertragsstatus TEXT,
  konditionen TEXT,
  zahlungsziel_tage INTEGER,
  kreditlimit NUMERIC,
  umsatz_jahr NUMERIC,
  notiz TEXT,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finanzen sehen Kunden" ON public.customers FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'finanz'));
CREATE POLICY "Finanzen legen Kunden an" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'finanz'));
CREATE POLICY "Finanzen aendern Kunden" ON public.customers FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'finanz'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'finanz'));
CREATE POLICY "Finanzen loeschen Kunden" ON public.customers FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'finanz'));

-- ============ INSURERS ============
CREATE TABLE public.insurers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kuerzel TEXT NOT NULL DEFAULT '',
  vertragsstatus TEXT NOT NULL DEFAULT 'Einzelfall',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurers TO authenticated;
GRANT ALL ON public.insurers TO service_role;
ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finanzen sehen Kassen" ON public.insurers FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'finanz'));
CREATE POLICY "Finanzen legen Kassen an" ON public.insurers FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'finanz'));
CREATE POLICY "Finanzen aendern Kassen" ON public.insurers FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'finanz'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'finanz'));
CREATE POLICY "Finanzen loeschen Kassen" ON public.insurers FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'finanz'));

-- ============ FACILITIES ============
CREATE TABLE public.facilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  adresse TEXT NOT NULL DEFAULT '',
  ansprechpartner TEXT NOT NULL DEFAULT '',
  telefon TEXT NOT NULL DEFAULT '',
  typ TEXT NOT NULL DEFAULT 'krankenhaus',
  email TEXT,
  fachbereiche JSONB NOT NULL DEFAULT '[]'::jsonb,
  kapazitaet INTEGER,
  oeffnungszeiten TEXT,
  kostentraeger TEXT,
  notiz TEXT,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facilities TO authenticated;
GRANT ALL ON public.facilities TO service_role;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Berechtigte sehen Einrichtungen" ON public.facilities FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition') OR private.has_role(auth.uid(), 'fahrer'));
CREATE POLICY "Disposition legt Einrichtungen an" ON public.facilities FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition'));
CREATE POLICY "Disposition aendert Einrichtungen" ON public.facilities FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition'));
CREATE POLICY "Disposition loescht Einrichtungen" ON public.facilities FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition'));

-- ============ PATIENTS ============
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mobilitaet TEXT NOT NULL DEFAULT 'Gehfähig',
  kostentraeger TEXT NOT NULL DEFAULT '',
  hinweis TEXT NOT NULL DEFAULT '',
  begleitperson BOOLEAN NOT NULL DEFAULT false,
  medizinische_notiz TEXT,
  patientennotiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Berechtigte sehen Patienten" ON public.patients FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition') OR private.has_role(auth.uid(), 'fahrer'));
CREATE POLICY "Disposition legt Patienten an" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition'));
CREATE POLICY "Disposition aendert Patienten" ON public.patients FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition'));
CREATE POLICY "Disposition loescht Patienten" ON public.patients FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition'));

-- ============ VEHICLES ============
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nummer TEXT NOT NULL DEFAULT '',
  kennzeichen TEXT NOT NULL DEFAULT '',
  marke TEXT NOT NULL DEFAULT '',
  modell TEXT NOT NULL DEFAULT '',
  baujahr INTEGER NOT NULL DEFAULT 2020,
  typ TEXT NOT NULL DEFAULT 'KTW',
  rollstuhl_geeignet BOOLEAN NOT NULL DEFAULT false,
  liegend_geeignet BOOLEAN NOT NULL DEFAULT false,
  sitzplaetze INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'frei',
  fahrer TEXT,
  standort TEXT NOT NULL DEFAULT '',
  gps JSONB NOT NULL DEFAULT '{"lat":52.29,"lng":8.9}'::jsonb,
  kilometerstand INTEGER NOT NULL DEFAULT 0,
  tankstand INTEGER NOT NULL DEFAULT 100,
  kraftstoff TEXT NOT NULL DEFAULT 'Diesel',
  verbrauch NUMERIC NOT NULL DEFAULT 0,
  reichweite INTEGER NOT NULL DEFAULT 0,
  kosten_pro_km NUMERIC NOT NULL DEFAULT 0,
  tagesumsatz NUMERIC NOT NULL DEFAULT 0,
  tagesgewinn NUMERIC NOT NULL DEFAULT 0,
  monatsumsatz NUMERIC NOT NULL DEFAULT 0,
  monatsgewinn NUMERIC NOT NULL DEFAULT 0,
  tuev_bis TEXT NOT NULL DEFAULT '',
  oelwechsel_bei INTEGER NOT NULL DEFAULT 0,
  naechste_wartung TEXT NOT NULL DEFAULT '',
  reifenstatus TEXT NOT NULL DEFAULT 'gut',
  reparaturen JSONB NOT NULL DEFAULT '[]'::jsonb,
  versicherung TEXT NOT NULL DEFAULT '',
  versicherung_bis TEXT NOT NULL DEFAULT '',
  leasingrate NUMERIC NOT NULL DEFAULT 0,
  leasing_ende TEXT NOT NULL DEFAULT '',
  dokumente JSONB NOT NULL DEFAULT '[]'::jsonb,
  fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
  notizen TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Berechtigte sehen Fahrzeuge" ON public.vehicles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition') OR private.has_role(auth.uid(), 'fahrer'));
CREATE POLICY "Disposition legt Fahrzeuge an" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition'));
CREATE POLICY "Disposition und Fahrer aendern Fahrzeuge" ON public.vehicles FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition') OR private.has_role(auth.uid(), 'fahrer'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition') OR private.has_role(auth.uid(), 'fahrer'));
CREATE POLICY "Disposition loescht Fahrzeuge" ON public.vehicles FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'disposition'));

-- Timestamp triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_insurers_updated_at BEFORE UPDATE ON public.insurers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON public.facilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
