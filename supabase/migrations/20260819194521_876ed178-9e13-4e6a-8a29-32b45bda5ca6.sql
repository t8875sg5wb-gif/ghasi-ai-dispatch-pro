CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- 1) Lohn-Eingabefakten je Fahrer
-- ============================================================
CREATE TABLE public.payroll_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  fakt_schluessel text NOT NULL,
  wert text NOT NULL,
  gueltig_ab date NOT NULL,
  gueltig_bis date,
  status text NOT NULL DEFAULT 'pruefung_erforderlich',
  version integer NOT NULL DEFAULT 1,
  notiz text NOT NULL DEFAULT '',
  created_by uuid,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_facts_status_check CHECK (status IN ('pruefung_erforderlich','verifiziert')),
  CONSTRAINT payroll_facts_schluessel_check CHECK (fakt_schluessel ~ '^[a-z0-9_]{2,60}$'),
  CONSTRAINT payroll_facts_wert_check CHECK (length(btrim(wert)) BETWEEN 1 AND 200),
  CONSTRAINT payroll_facts_zeitraum_check CHECK (gueltig_bis IS NULL OR gueltig_bis >= gueltig_ab),
  CONSTRAINT payroll_facts_no_overlap_verified EXCLUDE USING gist (
    driver_id WITH =,
    fakt_schluessel WITH =,
    daterange(gueltig_ab, COALESCE(gueltig_bis, 'infinity'::date), '[]') WITH &&
  ) WHERE (status = 'verifiziert')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_facts TO authenticated;
GRANT ALL ON public.payroll_facts TO service_role;
ALTER TABLE public.payroll_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finanzen und Admin lesen Lohnfakten"
ON public.payroll_facts FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE POLICY "Finanzen und Admin legen Lohnfakten an"
ON public.payroll_facts FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE POLICY "Finanzen und Admin aendern Lohnfakten"
ON public.payroll_facts FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE POLICY "Finanzen und Admin loeschen Lohnfakten"
ON public.payroll_facts FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE INDEX payroll_facts_driver_idx ON public.payroll_facts(driver_id, fakt_schluessel);

-- Audit-Log (append-only)
CREATE TABLE public.payroll_fact_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id uuid NOT NULL,
  driver_id uuid,
  fakt_schluessel text,
  aktion text NOT NULL,
  version integer,
  akteur_user_id uuid,
  old_row jsonb,
  new_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payroll_fact_audit_log TO authenticated;
GRANT ALL ON public.payroll_fact_audit_log TO service_role;
ALTER TABLE public.payroll_fact_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finanzen und Admin lesen Lohnfakt-Protokoll"
ON public.payroll_fact_audit_log FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE OR REPLACE FUNCTION public.enforce_payroll_fact_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  berechtigt boolean;
BEGIN
  berechtigt := uid IS NULL
    OR private.has_role(uid, 'admin'::public.app_role)
    OR private.has_role(uid, 'finanz'::public.app_role);

  IF NOT berechtigt THEN
    RAISE EXCEPTION 'Kein Zugriff: Lohn-Eingabefakten duerfen nur von Administration oder Finanzen bearbeitet werden.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pruefung_erforderlich';
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
      RAISE EXCEPTION 'Ein Lohn-Eingabefakt muss von einer zweiten berechtigten Person verifiziert werden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.driver_id IS DISTINCT FROM OLD.driver_id
       OR NEW.fakt_schluessel IS DISTINCT FROM OLD.fakt_schluessel
       OR NEW.wert IS DISTINCT FROM OLD.wert
       OR NEW.gueltig_ab IS DISTINCT FROM OLD.gueltig_ab
       OR NEW.gueltig_bis IS DISTINCT FROM OLD.gueltig_bis THEN
      RAISE EXCEPTION 'Inhaltliche Aenderung und Verifizierung sind nicht in einem Schritt moeglich.'
        USING ERRCODE = '42501';
    END IF;
    NEW.verified_by := uid;
    NEW.verified_at := now();
  ELSIF NEW.driver_id IS DISTINCT FROM OLD.driver_id
     OR NEW.fakt_schluessel IS DISTINCT FROM OLD.fakt_schluessel
     OR NEW.wert IS DISTINCT FROM OLD.wert
     OR NEW.gueltig_ab IS DISTINCT FROM OLD.gueltig_ab
     OR NEW.gueltig_bis IS DISTINCT FROM OLD.gueltig_bis THEN
    NEW.status := 'pruefung_erforderlich';
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
$$;

REVOKE ALL ON FUNCTION public.enforce_payroll_fact_rules() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_payroll_fact_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payroll_fact_audit_log
    (fact_id, driver_id, fakt_schluessel, aktion, version, akteur_user_id, old_row, new_row)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.driver_id, OLD.driver_id),
    COALESCE(NEW.fakt_schluessel, OLD.fakt_schluessel),
    lower(TG_OP),
    NEW.version,
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_payroll_fact_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER a_enforce_payroll_fact_rules
BEFORE INSERT OR UPDATE ON public.payroll_facts
FOR EACH ROW EXECUTE FUNCTION public.enforce_payroll_fact_rules();

CREATE TRIGGER update_payroll_facts_updated_at
BEFORE UPDATE ON public.payroll_facts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER z_log_payroll_fact_change
AFTER INSERT OR UPDATE OR DELETE ON public.payroll_facts
FOR EACH ROW EXECUTE FUNCTION public.log_payroll_fact_change();

-- ============================================================
-- 2) Lohn-Regelwerke
-- ============================================================
CREATE TABLE public.payroll_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kennung text NOT NULL,
  bezeichnung text NOT NULL,
  kategorie text NOT NULL,
  berechnungsart text NOT NULL,
  prozentsatz numeric(7,4),
  festbetrag numeric(12,2),
  gueltig_ab date NOT NULL,
  gueltig_bis date,
  quelle text NOT NULL,
  quelle_version text NOT NULL,
  status text NOT NULL DEFAULT 'entwurf',
  version integer NOT NULL DEFAULT 1,
  notiz text NOT NULL DEFAULT '',
  created_by uuid,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_rules_kennung_check CHECK (kennung ~ '^[a-z0-9_]{2,60}$'),
  CONSTRAINT payroll_rules_bezeichnung_check CHECK (length(btrim(bezeichnung)) BETWEEN 2 AND 160),
  CONSTRAINT payroll_rules_kategorie_check CHECK (kategorie IN ('arbeitnehmerabzug','arbeitgeberkosten')),
  CONSTRAINT payroll_rules_art_check CHECK (berechnungsart IN ('prozent','festbetrag')),
  CONSTRAINT payroll_rules_status_check CHECK (status IN ('entwurf','verifiziert')),
  CONSTRAINT payroll_rules_quelle_check CHECK (length(btrim(quelle)) BETWEEN 3 AND 300),
  CONSTRAINT payroll_rules_quelle_version_check CHECK (length(btrim(quelle_version)) BETWEEN 1 AND 60),
  CONSTRAINT payroll_rules_zeitraum_check CHECK (gueltig_bis IS NULL OR gueltig_bis >= gueltig_ab),
  CONSTRAINT payroll_rules_exactly_one_wert CHECK (
    (berechnungsart = 'prozent' AND prozentsatz IS NOT NULL AND prozentsatz > 0 AND festbetrag IS NULL)
    OR (berechnungsart = 'festbetrag' AND festbetrag IS NOT NULL AND festbetrag > 0 AND prozentsatz IS NULL)
  ),
  CONSTRAINT payroll_rules_no_overlap_verified EXCLUDE USING gist (
    kennung WITH =,
    daterange(gueltig_ab, COALESCE(gueltig_bis, 'infinity'::date), '[]') WITH &&
  ) WHERE (status = 'verifiziert')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_rules TO authenticated;
GRANT ALL ON public.payroll_rules TO service_role;
ALTER TABLE public.payroll_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finanzen und Admin lesen Lohnregeln"
ON public.payroll_rules FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE POLICY "Finanzen und Admin legen Lohnregeln an"
ON public.payroll_rules FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE POLICY "Finanzen und Admin aendern Lohnregeln"
ON public.payroll_rules FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE POLICY "Finanzen und Admin loeschen Lohnregeln"
ON public.payroll_rules FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE INDEX payroll_rules_kennung_idx ON public.payroll_rules(kennung, gueltig_ab DESC);

CREATE TABLE public.payroll_rule_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  kennung text,
  aktion text NOT NULL,
  version integer,
  akteur_user_id uuid,
  old_row jsonb,
  new_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payroll_rule_audit_log TO authenticated;
GRANT ALL ON public.payroll_rule_audit_log TO service_role;
ALTER TABLE public.payroll_rule_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finanzen und Admin lesen Lohnregel-Protokoll"
ON public.payroll_rule_audit_log FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE OR REPLACE FUNCTION public.enforce_payroll_rule_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.enforce_payroll_rule_rules() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_payroll_rule_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payroll_rule_audit_log
    (rule_id, kennung, aktion, version, akteur_user_id, old_row, new_row)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.kennung, OLD.kennung),
    lower(TG_OP),
    NEW.version,
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_payroll_rule_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER a_enforce_payroll_rule_rules
BEFORE INSERT OR UPDATE ON public.payroll_rules
FOR EACH ROW EXECUTE FUNCTION public.enforce_payroll_rule_rules();

CREATE TRIGGER update_payroll_rules_updated_at
BEFORE UPDATE ON public.payroll_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER z_log_payroll_rule_change
AFTER INSERT OR UPDATE OR DELETE ON public.payroll_rules
FOR EACH ROW EXECUTE FUNCTION public.log_payroll_rule_change();