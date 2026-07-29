ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fahrzeug_id uuid REFERENCES public.vehicles(id);
CREATE INDEX IF NOT EXISTS orders_fahrzeug_id_idx ON public.orders(fahrzeug_id);

UPDATE public.orders o
SET fahrzeug_id = v.id
FROM public.vehicles v
WHERE o.fahrzeug = v.kennzeichen
  AND o.fahrzeug_id IS NULL
  AND (SELECT count(*) FROM public.vehicles v2 WHERE v2.kennzeichen = o.fahrzeug) = 1;

CREATE OR REPLACE FUNCTION public.enforce_order_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  privilegiert boolean;
  d_name text;
  d_user uuid;
  v_kennzeichen text;
BEGIN
  privilegiert := uid IS NULL
    OR private.has_role(uid, 'admin'::public.app_role)
    OR private.has_role(uid, 'disposition'::public.app_role);

  IF TG_OP = 'UPDATE' AND NOT privilegiert THEN
    IF NEW.fahrer_id IS DISTINCT FROM OLD.fahrer_id
       OR NEW.fahrer IS DISTINCT FROM OLD.fahrer
       OR NEW.fahrer_user_id IS DISTINCT FROM OLD.fahrer_user_id
       OR NEW.fahrzeug IS DISTINCT FROM OLD.fahrzeug
       OR NEW.fahrzeug_id IS DISTINCT FROM OLD.fahrzeug_id THEN
      RAISE EXCEPTION 'Fahrer duerfen die Zuordnung eines Auftrags nicht aendern.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.fahrer_id IS NOT NULL THEN
    SELECT name, user_id INTO d_name, d_user
      FROM public.drivers WHERE id = NEW.fahrer_id;
    IF d_name IS NULL THEN
      RAISE EXCEPTION 'Unbekannter Fahrer-Datensatz.' USING ERRCODE = '23503';
    END IF;
    NEW.fahrer := d_name;
    NEW.fahrer_user_id := d_user;
  ELSIF TG_OP = 'UPDATE' AND OLD.fahrer_id IS NOT NULL THEN
    NEW.fahrer := NULL;
    NEW.fahrer_user_id := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.fahrer_user_id := NULL;
  END IF;

  -- Fahrzeug-Identitaetskette: Kennzeichen wird aus fahrzeug_id abgeleitet.
  -- Bewusst KEIN Leeren des Freitexts beim Entfernen der Verknuepfung
  -- (Altbestand-Kennzeichen ohne Stammdatensatz bleibt erhalten).
  IF NEW.fahrzeug_id IS NOT NULL THEN
    SELECT kennzeichen INTO v_kennzeichen
      FROM public.vehicles WHERE id = NEW.fahrzeug_id;
    IF v_kennzeichen IS NULL THEN
      RAISE EXCEPTION 'Unbekannter Fahrzeug-Datensatz.' USING ERRCODE = '23503';
    END IF;
    NEW.fahrzeug := v_kennzeichen;
  END IF;

  RETURN NEW;
END;
$function$;