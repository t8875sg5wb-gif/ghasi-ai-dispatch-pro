UPDATE public.orders o
SET fahrer_user_id = d.user_id
FROM public.drivers d
WHERE o.fahrer_id = d.id
  AND o.fahrer_user_id IS DISTINCT FROM d.user_id;

CREATE OR REPLACE FUNCTION public.sync_order_fahrer_user_id_on_driver_link_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;
  UPDATE public.orders
  SET fahrer_user_id = NEW.user_id
  WHERE fahrer_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_order_fahrer_user_id_on_driver_link_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_order_fahrer_user_id_on_driver_link_change() FROM anon;
REVOKE ALL ON FUNCTION public.sync_order_fahrer_user_id_on_driver_link_change() FROM authenticated;

DROP TRIGGER IF EXISTS z_sync_order_fahrer_user_id ON public.drivers;
CREATE TRIGGER z_sync_order_fahrer_user_id
AFTER UPDATE OF user_id ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.sync_order_fahrer_user_id_on_driver_link_change();

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fahrer_user_id_requires_fahrer_id;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_fahrer_user_id_requires_fahrer_id
  CHECK (fahrer_id IS NOT NULL OR fahrer_user_id IS NULL)
  NOT VALID;

DO $$
DECLARE
  verstoesse integer;
BEGIN
  SELECT count(*) INTO verstoesse
  FROM public.orders
  WHERE fahrer_id IS NULL AND fahrer_user_id IS NOT NULL;

  IF verstoesse = 0 THEN
    ALTER TABLE public.orders VALIDATE CONSTRAINT orders_fahrer_user_id_requires_fahrer_id;
  ELSE
    RAISE NOTICE 'Constraint nicht validiert: % Verstoesse', verstoesse;
  END IF;
END;
$$;