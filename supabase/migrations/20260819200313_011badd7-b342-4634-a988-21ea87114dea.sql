-- 1) Lohn-Regelwerke: optionale Voraussetzung eines geprüften Fakts
ALTER TABLE public.payroll_rules
  ADD COLUMN IF NOT EXISTS benoetigter_fakt text;

ALTER TABLE public.payroll_rules
  ADD CONSTRAINT payroll_rules_benoetigter_fakt_check
  CHECK (benoetigter_fakt IS NULL OR benoetigter_fakt ~ '^[a-z0-9_]{2,60}$');

-- Trigger neu, damit auch dieses Feld als inhaltliche Änderung zählt
CREATE OR REPLACE FUNCTION public.enforce_payroll_rule_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  berechtigt boolean;
BEGIN
  berechtigt := uid IS NULL
    OR private.has_role(uid, 'admin'::public.app_role)
    OR private.has_role(uid, 'finanz'::public.app_role);

  IF NOT berechtigt THEN
    RAISE EXCEPTION 'Kein Zugriff: Lohn-Regelwerke duerfen nur von Administration oder Finanzen bearbeitet werden.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'entwurf';
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
    NEW.version := 1;
    NEW.created_by := COALESCE(uid, NEW.created_by);
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;

  IF NEW.status = 'verifiziert' AND OLD.status <> 'verifiziert' THEN
    IF uid IS NOT NULL AND OLD.created_by IS NOT NULL AND uid = OLD.created_by THEN
      RAISE EXCEPTION 'Eine Lohnregel muss von einer zweiten berechtigten Person verifiziert werden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.kennung IS DISTINCT FROM OLD.kennung
       OR NEW.bezeichnung IS DISTINCT FROM OLD.bezeichnung
       OR NEW.kategorie IS DISTINCT FROM OLD.kategorie
       OR NEW.berechnungsart IS DISTINCT FROM OLD.berechnungsart
       OR NEW.prozentsatz IS DISTINCT FROM OLD.prozentsatz
       OR NEW.festbetrag IS DISTINCT FROM OLD.festbetrag
       OR NEW.benoetigter_fakt IS DISTINCT FROM OLD.benoetigter_fakt
       OR NEW.gueltig_ab IS DISTINCT FROM OLD.gueltig_ab
       OR NEW.gueltig_bis IS DISTINCT FROM OLD.gueltig_bis
       OR NEW.quelle IS DISTINCT FROM OLD.quelle
       OR NEW.quelle_version IS DISTINCT FROM OLD.quelle_version THEN
      RAISE EXCEPTION 'Inhaltliche Aenderung und Verifizierung sind nicht in einem Schritt moeglich.'
        USING ERRCODE = '42501';
    END IF;
    NEW.verified_by := uid;
    NEW.verified_at := now();
  ELSIF NEW.kennung IS DISTINCT FROM OLD.kennung
     OR NEW.bezeichnung IS DISTINCT FROM OLD.bezeichnung
     OR NEW.kategorie IS DISTINCT FROM OLD.kategorie
     OR NEW.berechnungsart IS DISTINCT FROM OLD.berechnungsart
     OR NEW.prozentsatz IS DISTINCT FROM OLD.prozentsatz
     OR NEW.festbetrag IS DISTINCT FROM OLD.festbetrag
     OR NEW.benoetigter_fakt IS DISTINCT FROM OLD.benoetigter_fakt
     OR NEW.gueltig_ab IS DISTINCT FROM OLD.gueltig_ab
     OR NEW.gueltig_bis IS DISTINCT FROM OLD.gueltig_bis
     OR NEW.quelle IS DISTINCT FROM OLD.quelle
     OR NEW.quelle_version IS DISTINCT FROM OLD.quelle_version THEN
    NEW.status := 'entwurf';
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
  ELSE
    NEW.status := OLD.status;
    NEW.verified_by := OLD.verified_by;
    NEW.verified_at := OLD.verified_at;
  END IF;

  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$function$;

-- 2) Lohnläufe
CREATE TABLE public.payroll_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  periode_monat date NOT NULL,
  status text NOT NULL DEFAULT 'offen',
  employment_id uuid REFERENCES public.employment_relationships(id) ON DELETE SET NULL,
  verguetungsart text,
  stunden numeric(10,2),
  stundenlohn numeric(12,2),
  brutto numeric(12,2),
  summe_abzuege numeric(12,2),
  netto numeric(12,2),
  summe_arbeitgeberkosten numeric(12,2),
  fehlende_punkte jsonb NOT NULL DEFAULT '[]'::jsonb,
  berechnet_am timestamp with time zone,
  berechnet_von uuid,
  version integer NOT NULL DEFAULT 1,
  notiz text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payroll_runs_status_check CHECK (status IN ('offen','berechnet','unvollstaendig')),
  CONSTRAINT payroll_runs_art_check CHECK (verguetungsart IS NULL OR verguetungsart IN ('stundenlohn','monatsbrutto')),
  CONSTRAINT payroll_runs_monatsanfang_check CHECK (periode_monat = date_trunc('month', periode_monat)::date),
  CONSTRAINT payroll_runs_unique_periode UNIQUE (driver_id, periode_monat)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_runs_select" ON public.payroll_runs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));
CREATE POLICY "payroll_runs_insert" ON public.payroll_runs FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));
CREATE POLICY "payroll_runs_update" ON public.payroll_runs FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));
CREATE POLICY "payroll_runs_delete" ON public.payroll_runs FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

-- 3) Lohnlauf-Posten (einzeln nachvollziehbar, Herkunftsregel erkennbar)
CREATE TABLE public.payroll_run_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.payroll_rules(id) ON DELETE SET NULL,
  regel_kennung text NOT NULL,
  regel_bezeichnung text NOT NULL,
  kategorie text NOT NULL,
  berechnungsart text NOT NULL,
  prozentsatz numeric(9,4),
  festbetrag numeric(12,2),
  basisbetrag numeric(12,2) NOT NULL,
  betrag numeric(12,2) NOT NULL,
  quelle text NOT NULL DEFAULT '',
  quelle_version text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payroll_run_items_kategorie_check CHECK (kategorie IN ('arbeitnehmerabzug','arbeitgeberkosten')),
  CONSTRAINT payroll_run_items_art_check CHECK (berechnungsart IN ('prozent','festbetrag')),
  CONSTRAINT payroll_run_items_unique_regel UNIQUE (run_id, rule_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_run_items TO authenticated;
GRANT ALL ON public.payroll_run_items TO service_role;
ALTER TABLE public.payroll_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_run_items_select" ON public.payroll_run_items FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));
CREATE POLICY "payroll_run_items_insert" ON public.payroll_run_items FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));
CREATE POLICY "payroll_run_items_update" ON public.payroll_run_items FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));
CREATE POLICY "payroll_run_items_delete" ON public.payroll_run_items FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE INDEX payroll_run_items_run_idx ON public.payroll_run_items(run_id);

-- 4) Änderungsprotokoll (append-only)
CREATE TABLE public.payroll_run_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL,
  driver_id uuid,
  periode_monat date,
  aktion text NOT NULL,
  version integer,
  akteur_user_id uuid,
  old_row jsonb,
  new_row jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payroll_run_audit_log TO authenticated;
GRANT ALL ON public.payroll_run_audit_log TO service_role;
ALTER TABLE public.payroll_run_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_run_audit_select" ON public.payroll_run_audit_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

-- 5) Regeln erzwingen: Rolle, Versionierung, unveränderliche Felder
CREATE OR REPLACE FUNCTION public.enforce_payroll_run_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  berechtigt boolean;
BEGIN
  berechtigt := uid IS NULL
    OR private.has_role(uid, 'admin'::public.app_role)
    OR private.has_role(uid, 'finanz'::public.app_role);

  IF NOT berechtigt THEN
    RAISE EXCEPTION 'Kein Zugriff: Lohnlaeufe duerfen nur von Administration oder Finanzen bearbeitet werden.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Neue Lohnlaeufe sind immer "offen" und enthalten keine Ergebnisse.
    NEW.status := 'offen';
    NEW.version := 1;
    NEW.created_by := COALESCE(uid, NEW.created_by);
    NEW.employment_id := NULL;
    NEW.verguetungsart := NULL;
    NEW.stunden := NULL;
    NEW.stundenlohn := NULL;
    NEW.brutto := NULL;
    NEW.summe_abzuege := NULL;
    NEW.netto := NULL;
    NEW.summe_arbeitgeberkosten := NULL;
    NEW.fehlende_punkte := '[]'::jsonb;
    NEW.berechnet_am := NULL;
    NEW.berechnet_von := NULL;
    RETURN NEW;
  END IF;

  -- Unveraenderliche Felder
  NEW.id := OLD.id;
  NEW.driver_id := OLD.driver_id;
  NEW.periode_monat := OLD.periode_monat;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  NEW.version := OLD.version + 1;

  -- Ergebnisfelder duerfen nur im Rahmen einer Berechnung gesetzt werden.
  IF NEW.status IN ('berechnet','unvollstaendig')
     AND (OLD.status IS DISTINCT FROM NEW.status
          OR NEW.brutto IS DISTINCT FROM OLD.brutto
          OR NEW.summe_abzuege IS DISTINCT FROM OLD.summe_abzuege
          OR NEW.netto IS DISTINCT FROM OLD.netto
          OR NEW.summe_arbeitgeberkosten IS DISTINCT FROM OLD.summe_arbeitgeberkosten
          OR NEW.fehlende_punkte IS DISTINCT FROM OLD.fehlende_punkte) THEN
    NEW.berechnet_am := now();
    NEW.berechnet_von := COALESCE(uid, NEW.berechnet_von);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER a_enforce_payroll_run_rules
  BEFORE INSERT OR UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payroll_run_rules();

CREATE TRIGGER update_payroll_runs_updated_at
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_payroll_run_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.payroll_run_audit_log
    (run_id, driver_id, periode_monat, aktion, version, akteur_user_id, old_row, new_row)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.driver_id, OLD.driver_id),
    COALESCE(NEW.periode_monat, OLD.periode_monat),
    lower(TG_OP),
    NEW.version,
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN NULL;
END;
$function$;

CREATE TRIGGER z_log_payroll_run_change
  AFTER INSERT OR UPDATE OR DELETE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.log_payroll_run_change();