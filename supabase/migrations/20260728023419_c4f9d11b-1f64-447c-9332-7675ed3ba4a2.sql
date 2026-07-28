-- 1) Eine Kontoverknüpfung darf nur zu einem Fahrer gehören
CREATE UNIQUE INDEX IF NOT EXISTS drivers_user_id_unique
  ON public.drivers (user_id)
  WHERE user_id IS NOT NULL;

-- 2) drivers.user_id ist ein Admin-only Identitätsfeld
CREATE OR REPLACE FUNCTION public.enforce_driver_account_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  -- Kein JWT => service_role / Wartung
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT private.has_role(uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Nur Administratoren duerfen die Kontoverknuepfung eines Fahrers aendern.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_driver_account_link ON public.drivers;
CREATE TRIGGER trg_enforce_driver_account_link
  BEFORE INSERT OR UPDATE OF user_id ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_driver_account_link();

-- 3) Stabile Fahrer-Referenz auf Auftraegen
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fahrer_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_fahrer_id_fkey' AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_fahrer_id_fkey
      FOREIGN KEY (fahrer_id) REFERENCES public.drivers(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS orders_fahrer_id_idx ON public.orders (fahrer_id);

-- 4) Zuordnungsfelder ableiten + gegen Fahrer-Rolle schuetzen
CREATE OR REPLACE FUNCTION public.enforce_order_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  privilegiert boolean;
  d_name text;
  d_user uuid;
BEGIN
  privilegiert := uid IS NULL
    OR private.has_role(uid, 'admin'::public.app_role)
    OR private.has_role(uid, 'disposition'::public.app_role);

  IF TG_OP = 'UPDATE' AND NOT privilegiert THEN
    IF NEW.fahrer_id IS DISTINCT FROM OLD.fahrer_id
       OR NEW.fahrer IS DISTINCT FROM OLD.fahrer
       OR NEW.fahrer_user_id IS DISTINCT FROM OLD.fahrer_user_id
       OR NEW.fahrzeug IS DISTINCT FROM OLD.fahrzeug THEN
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_assignment ON public.orders;
CREATE TRIGGER trg_enforce_order_assignment
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_assignment();