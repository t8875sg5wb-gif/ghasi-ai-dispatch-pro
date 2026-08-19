CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ============================================================
-- 1) Haupttabelle
-- ============================================================
CREATE TABLE public.employment_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
  verguetungsart text NOT NULL,
  stundenlohn numeric(10,2),
  monatsbrutto numeric(10,2),
  gueltig_ab date NOT NULL,
  gueltig_bis date,
  status text NOT NULL DEFAULT 'pruefung_erforderlich',
  version integer NOT NULL DEFAULT 1,
  notiz text NOT NULL DEFAULT '',
  created_by uuid,
  verified_by uuid,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT employment_verguetungsart_check
    CHECK (verguetungsart IN ('stundenlohn','monatsbrutto')),
  CONSTRAINT employment_status_check
    CHECK (status IN ('pruefung_erforderlich','verifiziert')),
  -- Genau EINE Vergütungsform, nie beides gleichzeitig, nie leer.
  CONSTRAINT employment_exactly_one_amount CHECK (
    (verguetungsart = 'stundenlohn'  AND stundenlohn  IS NOT NULL AND stundenlohn  > 0 AND monatsbrutto IS NULL)
    OR
    (verguetungsart = 'monatsbrutto' AND monatsbrutto IS NOT NULL AND monatsbrutto > 0 AND stundenlohn  IS NULL)
  ),
  CONSTRAINT employment_zeitraum_check CHECK (gueltig_bis IS NULL OR gueltig_bis >= gueltig_ab),
  CONSTRAINT employment_version_check CHECK (version >= 1)
);

CREATE INDEX idx_employment_driver ON public.employment_relationships (driver_id, gueltig_ab DESC);

-- Harte Datenbankgarantie: zwei VERIFIZIERTE Verhältnisse desselben Fahrers
-- dürfen sich zeitlich nie überschneiden (offenes Ende = unendlich).
SET LOCAL search_path = public, extensions;
ALTER TABLE public.employment_relationships
  ADD CONSTRAINT employment_no_overlap_verified
  EXCLUDE USING gist (
    driver_id WITH =,
    daterange(gueltig_ab, gueltig_bis, '[]') WITH &&
  ) WHERE (status = 'verifiziert');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employment_relationships TO authenticated;
GRANT ALL ON public.employment_relationships TO service_role;
ALTER TABLE public.employment_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finanzrollen lesen Beschaeftigungsverhaeltnisse"
  ON public.employment_relationships FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)
      OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE POLICY "Finanzrollen legen Beschaeftigungsverhaeltnisse an"
  ON public.employment_relationships FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role)
           OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE POLICY "Finanzrollen aendern Beschaeftigungsverhaeltnisse"
  ON public.employment_relationships FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)
      OR private.has_role(auth.uid(), 'finanz'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role)
           OR private.has_role(auth.uid(), 'finanz'::public.app_role));

CREATE POLICY "Finanzrollen loeschen Beschaeftigungsverhaeltnisse"
  ON public.employment_relationships FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)
      OR private.has_role(auth.uid(), 'finanz'::public.app_role));

-- ============================================================
-- 2) Append-only Änderungsprotokoll
-- ============================================================
CREATE TABLE public.employment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employment_id uuid NOT NULL,
  driver_id uuid,
  aktion text NOT NULL,
  version integer,
  akteur_user_id uuid,
  old_row jsonb,
  new_row jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_employment_audit_employment ON public.employment_audit_log (employment_id, created_at DESC);

GRANT SELECT ON public.employment_audit_log TO authenticated;
GRANT ALL ON public.employment_audit_log TO service_role;
ALTER TABLE public.employment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finanzrollen lesen das Beschaeftigungsprotokoll"
  ON public.employment_audit_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)
      OR private.has_role(auth.uid(), 'finanz'::public.app_role));

-- ============================================================
-- 3) Serverseitige Regeldurchsetzung
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_employment_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  berechtigt boolean;
BEGIN
  berechtigt := uid IS NULL
    OR private.has_role(uid, 'admin'::public.app_role)
    OR private.has_role(uid, 'finanz'::public.app_role);

  IF NOT berechtigt THEN
    RAISE EXCEPTION 'Kein Zugriff: Beschaeftigungsverhaeltnisse duerfen nur von Administration oder Finanzen bearbeitet werden.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Keine automatische Verifizierung, egal was der Client schickt.
    NEW.status := 'pruefung_erforderlich';
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
    NEW.version := 1;
    NEW.created_by := COALESCE(uid, NEW.created_by);
    RETURN NEW;
  END IF;

  -- UPDATE: unveraenderliche Felder festhalten
  NEW.id := OLD.id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;

  IF NEW.status = 'verifiziert' AND OLD.status <> 'verifiziert' THEN
    -- Vier-Augen-Prinzip: nicht dieselbe Person, die angelegt hat.
    IF uid IS NOT NULL AND OLD.created_by IS NOT NULL AND uid = OLD.created_by THEN
      RAISE EXCEPTION 'Ein Beschaeftigungsverhaeltnis muss von einer zweiten berechtigten Person verifiziert werden.'
        USING ERRCODE = '42501';
    END IF;
    -- Beim Verifizieren darf sich inhaltlich nichts aendern.
    IF NEW.driver_id IS DISTINCT FROM OLD.driver_id
       OR NEW.verguetungsart IS DISTINCT FROM OLD.verguetungsart
       OR NEW.stundenlohn IS DISTINCT FROM OLD.stundenlohn
       OR NEW.monatsbrutto IS DISTINCT FROM OLD.monatsbrutto
       OR NEW.gueltig_ab IS DISTINCT FROM OLD.gueltig_ab
       OR NEW.gueltig_bis IS DISTINCT FROM OLD.gueltig_bis THEN
      RAISE EXCEPTION 'Inhaltliche Aenderung und Verifizierung sind nicht in einem Schritt moeglich.'
        USING ERRCODE = '42501';
    END IF;
    NEW.verified_by := uid;
    NEW.verified_at := now();
  ELSIF NEW.driver_id IS DISTINCT FROM OLD.driver_id
     OR NEW.verguetungsart IS DISTINCT FROM OLD.verguetungsart
     OR NEW.stundenlohn IS DISTINCT FROM OLD.stundenlohn
     OR NEW.monatsbrutto IS DISTINCT FROM OLD.monatsbrutto
     OR NEW.gueltig_ab IS DISTINCT FROM OLD.gueltig_ab
     OR NEW.gueltig_bis IS DISTINCT FROM OLD.gueltig_bis THEN
    -- Jede inhaltliche Aenderung erzwingt eine erneute Pruefung.
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

REVOKE ALL ON FUNCTION public.enforce_employment_rules() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER a_enforce_employment_rules
  BEFORE INSERT OR UPDATE ON public.employment_relationships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_employment_rules();

CREATE TRIGGER update_employment_updated_at
  BEFORE UPDATE ON public.employment_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_employment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.employment_audit_log
    (employment_id, driver_id, aktion, version, akteur_user_id, old_row, new_row)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.driver_id, OLD.driver_id),
    lower(TG_OP),
    NEW.version,
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_employment_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER z_log_employment_change
  AFTER INSERT OR UPDATE OR DELETE ON public.employment_relationships
  FOR EACH ROW EXECUTE FUNCTION public.log_employment_change();