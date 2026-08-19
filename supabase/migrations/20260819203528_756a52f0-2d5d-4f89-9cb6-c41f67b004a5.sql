-- 1) Neue Zustände + Freigabefelder
ALTER TABLE public.payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_status_check;
ALTER TABLE public.payroll_runs
  ADD CONSTRAINT payroll_runs_status_check CHECK (status = ANY (ARRAY['offen','berechnet','unvollstaendig','zur_freigabe','freigegeben']));

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS vorgelegt_von uuid,
  ADD COLUMN IF NOT EXISTS vorgelegt_am timestamptz,
  ADD COLUMN IF NOT EXISTS vorgelegt_version integer,
  ADD COLUMN IF NOT EXISTS freigegeben_von uuid,
  ADD COLUMN IF NOT EXISTS freigegeben_am timestamptz,
  ADD COLUMN IF NOT EXISTS entschieden_von uuid,
  ADD COLUMN IF NOT EXISTS entschieden_am timestamptz,
  ADD COLUMN IF NOT EXISTS ablehnung_grund text;

-- 2) Regelwerk-Trigger erweitern: Übergänge, Vier-Augen-Prinzip, Unveränderlichkeit
CREATE OR REPLACE FUNCTION public.enforce_payroll_run_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  berechtigt boolean;
  ergebnis_geaendert boolean;
BEGIN
  berechtigt := uid IS NULL
    OR private.has_role(uid, 'admin'::public.app_role)
    OR private.has_role(uid, 'finanz'::public.app_role);

  IF NOT berechtigt THEN
    RAISE EXCEPTION 'Kein Zugriff: Lohnlaeufe duerfen nur von Administration oder Finanzen bearbeitet werden.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
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
    NEW.vorgelegt_von := NULL;
    NEW.vorgelegt_am := NULL;
    NEW.vorgelegt_version := NULL;
    NEW.freigegeben_von := NULL;
    NEW.freigegeben_am := NULL;
    NEW.entschieden_von := NULL;
    NEW.entschieden_am := NULL;
    NEW.ablehnung_grund := NULL;
    RETURN NEW;
  END IF;

  -- Nach Freigabe: technisch unveraenderlich.
  IF OLD.status = 'freigegeben' THEN
    RAISE EXCEPTION 'Ein freigegebener Lohnlauf ist unveraenderlich und kann nicht mehr geaendert werden.'
      USING ERRCODE = '42501';
  END IF;

  -- Unveraenderliche Kopffelder
  NEW.id := OLD.id;
  NEW.driver_id := OLD.driver_id;
  NEW.periode_monat := OLD.periode_monat;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  NEW.version := OLD.version + 1;

  ergebnis_geaendert :=
       NEW.brutto IS DISTINCT FROM OLD.brutto
    OR NEW.summe_abzuege IS DISTINCT FROM OLD.summe_abzuege
    OR NEW.netto IS DISTINCT FROM OLD.netto
    OR NEW.summe_arbeitgeberkosten IS DISTINCT FROM OLD.summe_arbeitgeberkosten
    OR NEW.fehlende_punkte IS DISTINCT FROM OLD.fehlende_punkte
    OR NEW.employment_id IS DISTINCT FROM OLD.employment_id
    OR NEW.verguetungsart IS DISTINCT FROM OLD.verguetungsart
    OR NEW.stunden IS DISTINCT FROM OLD.stunden
    OR NEW.stundenlohn IS DISTINCT FROM OLD.stundenlohn;

  -- ---------- Vorlage zur Freigabe ----------
  IF NEW.status = 'zur_freigabe' AND OLD.status <> 'zur_freigabe' THEN
    IF OLD.status <> 'berechnet' THEN
      RAISE EXCEPTION 'Nur ein vollstaendig berechneter Lohnlauf kann zur Freigabe vorgelegt werden.'
        USING ERRCODE = '42501';
    END IF;
    IF ergebnis_geaendert THEN
      RAISE EXCEPTION 'Inhaltliche Aenderung und Vorlage zur Freigabe sind nicht in einem Schritt moeglich.'
        USING ERRCODE = '42501';
    END IF;
    NEW.vorgelegt_von := COALESCE(uid, OLD.created_by);
    NEW.vorgelegt_am := now();
    NEW.vorgelegt_version := NEW.version;
    NEW.freigegeben_von := NULL;
    NEW.freigegeben_am := NULL;
    NEW.entschieden_von := NULL;
    NEW.entschieden_am := NULL;
    NEW.ablehnung_grund := NULL;
    RETURN NEW;
  END IF;

  -- ---------- Freigabe ----------
  IF NEW.status = 'freigegeben' THEN
    IF OLD.status <> 'zur_freigabe' THEN
      RAISE EXCEPTION 'Nur ein zur Freigabe vorgelegter Lohnlauf kann freigegeben werden.'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.vorgelegt_version IS DISTINCT FROM OLD.version THEN
      RAISE EXCEPTION 'Der Rechenstand hat sich seit der Vorlage geaendert. Der Lohnlauf muss erneut vorgelegt werden.'
        USING ERRCODE = '42501';
    END IF;
    IF ergebnis_geaendert THEN
      RAISE EXCEPTION 'Bei der Freigabe darf sich inhaltlich nichts aendern.'
        USING ERRCODE = '42501';
    END IF;
    IF uid IS NOT NULL AND (uid = OLD.vorgelegt_von OR uid = OLD.berechnet_von) THEN
      RAISE EXCEPTION 'Ein Lohnlauf muss von einer zweiten berechtigten Person freigegeben werden.'
        USING ERRCODE = '42501';
    END IF;
    NEW.vorgelegt_von := OLD.vorgelegt_von;
    NEW.vorgelegt_am := OLD.vorgelegt_am;
    NEW.vorgelegt_version := OLD.vorgelegt_version;
    NEW.freigegeben_von := uid;
    NEW.freigegeben_am := now();
    NEW.entschieden_von := uid;
    NEW.entschieden_am := now();
    NEW.ablehnung_grund := NULL;
    RETURN NEW;
  END IF;

  -- ---------- Ablehnung / automatische Entwertung der Vorlage ----------
  IF OLD.status = 'zur_freigabe' THEN
    IF NEW.status NOT IN ('berechnet','unvollstaendig') THEN
      RAISE EXCEPTION 'Unzulaessiger Statuswechsel fuer einen vorgelegten Lohnlauf.'
        USING ERRCODE = '42501';
    END IF;

    IF ergebnis_geaendert THEN
      -- Neuberechnung: Vorlage verfaellt automatisch.
      NEW.vorgelegt_von := NULL;
      NEW.vorgelegt_am := NULL;
      NEW.vorgelegt_version := NULL;
      NEW.ablehnung_grund := NULL;
      NEW.freigegeben_von := NULL;
      NEW.freigegeben_am := NULL;
      NEW.entschieden_von := NULL;
      NEW.entschieden_am := NULL;
      NEW.berechnet_am := now();
      NEW.berechnet_von := COALESCE(uid, NEW.berechnet_von);
      RETURN NEW;
    END IF;

    -- Ablehnung
    IF NEW.ablehnung_grund IS NULL OR btrim(NEW.ablehnung_grund) = '' THEN
      RAISE EXCEPTION 'Eine Ablehnung erfordert einen Grund.' USING ERRCODE = '42501';
    END IF;
    IF uid IS NOT NULL AND (uid = OLD.vorgelegt_von OR uid = OLD.berechnet_von) THEN
      RAISE EXCEPTION 'Ein Lohnlauf muss von einer zweiten berechtigten Person entschieden werden.'
        USING ERRCODE = '42501';
    END IF;
    NEW.status := 'berechnet';
    NEW.vorgelegt_von := NULL;
    NEW.vorgelegt_am := NULL;
    NEW.vorgelegt_version := NULL;
    NEW.freigegeben_von := NULL;
    NEW.freigegeben_am := NULL;
    NEW.entschieden_von := uid;
    NEW.entschieden_am := now();
    RETURN NEW;
  END IF;

  -- ---------- Normale Berechnung ----------
  NEW.vorgelegt_von := OLD.vorgelegt_von;
  NEW.vorgelegt_am := OLD.vorgelegt_am;
  NEW.vorgelegt_version := OLD.vorgelegt_version;
  NEW.freigegeben_von := OLD.freigegeben_von;
  NEW.freigegeben_am := OLD.freigegeben_am;

  IF NEW.status IN ('berechnet','unvollstaendig')
     AND (OLD.status IS DISTINCT FROM NEW.status OR ergebnis_geaendert) THEN
    NEW.berechnet_am := now();
    NEW.berechnet_von := COALESCE(uid, NEW.berechnet_von);
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Loeschschutz fuer freigegebene Lohnlaeufe
CREATE OR REPLACE FUNCTION public.prevent_payroll_run_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'freigegeben' THEN
    RAISE EXCEPTION 'Ein freigegebener Lohnlauf kann nicht geloescht werden.' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS a_prevent_payroll_run_delete ON public.payroll_runs;
CREATE TRIGGER a_prevent_payroll_run_delete
BEFORE DELETE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.prevent_payroll_run_delete();

-- 4) Posten eines freigegebenen Lohnlaufs sind unveraenderlich
CREATE OR REPLACE FUNCTION public.enforce_payroll_run_item_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ziel uuid := COALESCE(NEW.run_id, OLD.run_id);
  s text;
BEGIN
  SELECT status INTO s FROM public.payroll_runs WHERE id = ziel;
  IF s = 'freigegeben' THEN
    RAISE EXCEPTION 'Die Posten eines freigegebenen Lohnlaufs sind unveraenderlich.'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS a_enforce_payroll_run_item_immutability ON public.payroll_run_items;
CREATE TRIGGER a_enforce_payroll_run_item_immutability
BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_run_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_payroll_run_item_immutability();