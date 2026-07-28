-- Gemeinsames Muster: deny-by-default Spalten-Whitelist fuer nicht privilegierte Nutzer.

CREATE OR REPLACE FUNCTION public.enforce_driver_column_whitelist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  erlaubt text[] := ARRAY['updated_at','telefon','foto','status','standort','gps'];
  k text;
  alt jsonb := to_jsonb(OLD);
  neu jsonb := to_jsonb(NEW);
BEGIN
  IF uid IS NULL
     OR private.has_role(uid, 'admin'::public.app_role)
     OR private.has_role(uid, 'disposition'::public.app_role) THEN
    RETURN NEW;
  END IF;

  FOR k IN SELECT jsonb_object_keys(neu) LOOP
    IF (neu -> k) IS DISTINCT FROM (alt -> k) AND NOT (k = ANY(erlaubt)) THEN
      RAISE EXCEPTION 'Fahrer duerfen das Feld % nicht aendern.', k USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_order_column_whitelist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  erlaubt text[] := ARRAY['updated_at','status','detail_status','lifecycle','unterschrift'];
  k text;
  alt jsonb := to_jsonb(OLD);
  neu jsonb := to_jsonb(NEW);
BEGIN
  IF uid IS NULL
     OR private.has_role(uid, 'admin'::public.app_role)
     OR private.has_role(uid, 'disposition'::public.app_role) THEN
    RETURN NEW;
  END IF;

  FOR k IN SELECT jsonb_object_keys(neu) LOOP
    IF (neu -> k) IS DISTINCT FROM (alt -> k) AND NOT (k = ANY(erlaubt)) THEN
      RAISE EXCEPTION 'Fahrer duerfen das Feld % nicht aendern.', k USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_vehicle_column_whitelist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  erlaubt text[] := ARRAY['updated_at','kilometerstand','tankstand','status','standort','gps',
                          'real_lat','real_lng','real_gps_at','last_real_lat','last_real_lng','last_real_at'];
  k text;
  alt jsonb := to_jsonb(OLD);
  neu jsonb := to_jsonb(NEW);
BEGIN
  IF uid IS NULL
     OR private.has_role(uid, 'admin'::public.app_role)
     OR private.has_role(uid, 'disposition'::public.app_role) THEN
    RETURN NEW;
  END IF;

  FOR k IN SELECT jsonb_object_keys(neu) LOOP
    IF (neu -> k) IS DISTINCT FROM (alt -> k) AND NOT (k = ANY(erlaubt)) THEN
      RAISE EXCEPTION 'Fahrer duerfen das Feld % nicht aendern.', k USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_driver_column_whitelist() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_order_column_whitelist() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_vehicle_column_whitelist() FROM PUBLIC, anon, authenticated;

-- Trigger-Namen mit "a_" Praefix: laufen vor enforce_order_assignment /
-- enforce_driver_account_link, damit die Whitelist die Rohwerte des Clients
-- prueft und nicht serverseitig abgeleitete Werte.
DROP TRIGGER IF EXISTS a_enforce_driver_column_whitelist ON public.drivers;
CREATE TRIGGER a_enforce_driver_column_whitelist
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_driver_column_whitelist();

DROP TRIGGER IF EXISTS a_enforce_order_column_whitelist ON public.orders;
CREATE TRIGGER a_enforce_order_column_whitelist
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_column_whitelist();

DROP TRIGGER IF EXISTS a_enforce_vehicle_column_whitelist ON public.vehicles;
CREATE TRIGGER a_enforce_vehicle_column_whitelist
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vehicle_column_whitelist();