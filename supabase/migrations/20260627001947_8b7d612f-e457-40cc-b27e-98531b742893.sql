-- =========================================================
-- GHASI AI – Core chain persistence: orders, recurring_orders, invoices
-- =========================================================

-- ---------- ORDERS (Aufträge) ----------
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nummer text NOT NULL,
  patient text NOT NULL DEFAULT '',
  transportart text NOT NULL DEFAULT 'Sitzendtransport',
  prioritaet text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'neu',
  abholort text NOT NULL DEFAULT '',
  zielort text NOT NULL DEFAULT '',
  termin timestamptz NOT NULL DEFAULT now(),
  fahrer text,
  fahrzeug text,
  fahrer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kostentraeger text NOT NULL DEFAULT '',
  notiz text NOT NULL DEFAULT '',
  verordnung text NOT NULL DEFAULT 'nicht_erhalten',
  verordnung_dokument_id text,
  mobilitaet text,
  begleitperson boolean NOT NULL DEFAULT false,
  abholanforderung text NOT NULL DEFAULT '',
  zielanforderung text NOT NULL DEFAULT '',
  patientennotiz text NOT NULL DEFAULT '',
  medizinische_notiz text NOT NULL DEFAULT '',
  detail_status text,
  lifecycle jsonb NOT NULL DEFAULT '{}'::jsonb,
  unterschrift text,
  abrechnung_status text NOT NULL DEFAULT 'offen',
  dauerauftrag_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Angemeldete sehen Aufträge"
  ON public.orders FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Disposition legt Aufträge an"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'disposition'));

CREATE POLICY "Disposition und Fahrer ändern Aufträge"
  ON public.orders FOR UPDATE TO authenticated
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

CREATE POLICY "Disposition löscht Aufträge"
  ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'disposition'));

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_termin ON public.orders(termin);
CREATE INDEX idx_orders_dauerauftrag ON public.orders(dauerauftrag_id);

-- ---------- RECURRING ORDERS (Daueraufträge) ----------
CREATE TABLE public.recurring_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kennung text NOT NULL,
  patient text NOT NULL DEFAULT '',
  abholort text NOT NULL DEFAULT '',
  zielort text NOT NULL DEFAULT '',
  terminzeit text NOT NULL DEFAULT '08:00',
  rueckfahrt boolean NOT NULL DEFAULT false,
  rueckfahrtzeit text,
  mobilitaet text NOT NULL DEFAULT 'gehfaehig',
  begleitperson boolean NOT NULL DEFAULT false,
  verordnung_erforderlich boolean NOT NULL DEFAULT true,
  kostentraeger text NOT NULL DEFAULT '',
  krankenkasse text NOT NULL DEFAULT '',
  bevorzugtes_fahrzeug text,
  bevorzugter_fahrer text,
  notiz text NOT NULL DEFAULT '',
  medizinische_notiz text NOT NULL DEFAULT '',
  kategorie text NOT NULL DEFAULT 'sonstige',
  rhythmus text NOT NULL DEFAULT 'woechentlich',
  wochentage integer[] NOT NULL DEFAULT '{}',
  start_datum date NOT NULL DEFAULT current_date,
  end_datum date,
  pausiert boolean NOT NULL DEFAULT false,
  pause_von date,
  pause_bis date,
  feiertage_ueberspringen boolean NOT NULL DEFAULT true,
  uebersprungene_termine text[] NOT NULL DEFAULT '{}',
  generierte_termine text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_orders TO authenticated;
GRANT ALL ON public.recurring_orders TO service_role;

ALTER TABLE public.recurring_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Angemeldete sehen Daueraufträge"
  ON public.recurring_orders FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Disposition legt Daueraufträge an"
  ON public.recurring_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'disposition'));

CREATE POLICY "Disposition ändert Daueraufträge"
  ON public.recurring_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'disposition'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'disposition'));

CREATE POLICY "Disposition löscht Daueraufträge"
  ON public.recurring_orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'disposition'));

CREATE TRIGGER update_recurring_orders_updated_at
  BEFORE UPDATE ON public.recurring_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- INVOICES (Rechnungen) ----------
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nummer text NOT NULL,
  typ text NOT NULL DEFAULT 'rechnung',
  kunde text NOT NULL DEFAULT '',
  kunde_id text NOT NULL DEFAULT '',
  abrechnungsart text NOT NULL DEFAULT 'Krankenkasse',
  betrag numeric NOT NULL DEFAULT 0,
  mwst_satz numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'entwurf',
  datum date NOT NULL DEFAULT current_date,
  faelligkeit date NOT NULL DEFAULT current_date,
  bezahlt_am date,
  bezahlter_betrag numeric,
  bezug_auftrag text,
  positionen jsonb NOT NULL DEFAULT '[]'::jsonb,
  notiz text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finanzen sehen Rechnungen"
  ON public.invoices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanz'));

CREATE POLICY "Finanzen legen Rechnungen an"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanz'));

CREATE POLICY "Finanzen ändern Rechnungen"
  ON public.invoices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanz'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanz'));

CREATE POLICY "Finanzen löschen Rechnungen"
  ON public.invoices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanz'));

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_bezug ON public.invoices(bezug_auftrag);