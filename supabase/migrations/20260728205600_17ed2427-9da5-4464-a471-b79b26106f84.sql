ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurer_id uuid REFERENCES public.insurers(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_orders
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurer_id uuid REFERENCES public.insurers(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.enforce_order_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_name text;
  i_name text;
BEGIN
  IF NEW.patient_id IS NOT NULL THEN
    SELECT name INTO p_name FROM public.patients WHERE id = NEW.patient_id;
    IF p_name IS NULL THEN
      RAISE EXCEPTION 'Unbekannter Patienten-Datensatz.' USING ERRCODE = '23503';
    END IF;
    NEW.patient := p_name;
  END IF;

  IF NEW.insurer_id IS NOT NULL THEN
    SELECT name INTO i_name FROM public.insurers WHERE id = NEW.insurer_id;
    IF i_name IS NULL THEN
      RAISE EXCEPTION 'Unbekannter Kostentraeger-Datensatz.' USING ERRCODE = '23503';
    END IF;
    NEW.kostentraeger := i_name;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_order_identity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS b_enforce_order_identity ON public.orders;
CREATE TRIGGER b_enforce_order_identity
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_identity();

DROP TRIGGER IF EXISTS b_enforce_order_identity ON public.recurring_orders;
CREATE TRIGGER b_enforce_order_identity
BEFORE INSERT OR UPDATE ON public.recurring_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_identity();

-- Backfill: orders
UPDATE public.orders o
SET patient_id = m.pid
FROM (
  SELECT lower(btrim(p.name)) AS key, min(p.id::text)::uuid AS pid
  FROM public.patients p
  GROUP BY 1
  HAVING count(*) = 1
) m
WHERE o.patient_id IS NULL
  AND o.patient IS NOT NULL
  AND lower(btrim(o.patient)) = m.key;

UPDATE public.orders o
SET insurer_id = p.kostentraeger_id
FROM public.patients p
WHERE o.insurer_id IS NULL
  AND o.patient_id = p.id
  AND p.kostentraeger_id IS NOT NULL;

UPDATE public.orders o
SET insurer_id = m.iid
FROM (
  SELECT key, min(id::text)::uuid AS iid
  FROM (
    SELECT lower(btrim(i.name)) AS key, i.id FROM public.insurers i
    UNION ALL
    SELECT lower(btrim(i.kuerzel)) AS key, i.id FROM public.insurers i WHERE i.kuerzel IS NOT NULL AND btrim(i.kuerzel) <> ''
  ) u
  GROUP BY key
  HAVING count(DISTINCT id) = 1
) m
WHERE o.insurer_id IS NULL
  AND o.kostentraeger IS NOT NULL
  AND lower(btrim(o.kostentraeger)) = m.key;

-- Backfill: recurring_orders
UPDATE public.recurring_orders o
SET patient_id = m.pid
FROM (
  SELECT lower(btrim(p.name)) AS key, min(p.id::text)::uuid AS pid
  FROM public.patients p
  GROUP BY 1
  HAVING count(*) = 1
) m
WHERE o.patient_id IS NULL
  AND o.patient IS NOT NULL
  AND lower(btrim(o.patient)) = m.key;

UPDATE public.recurring_orders o
SET insurer_id = p.kostentraeger_id
FROM public.patients p
WHERE o.insurer_id IS NULL
  AND o.patient_id = p.id
  AND p.kostentraeger_id IS NOT NULL;

UPDATE public.recurring_orders o
SET insurer_id = m.iid
FROM (
  SELECT key, min(id::text)::uuid AS iid
  FROM (
    SELECT lower(btrim(i.name)) AS key, i.id FROM public.insurers i
    UNION ALL
    SELECT lower(btrim(i.kuerzel)) AS key, i.id FROM public.insurers i WHERE i.kuerzel IS NOT NULL AND btrim(i.kuerzel) <> ''
  ) u
  GROUP BY key
  HAVING count(DISTINCT id) = 1
) m
WHERE o.insurer_id IS NULL
  AND o.kostentraeger IS NOT NULL
  AND lower(btrim(o.kostentraeger)) = m.key;

DO $$
DECLARE
  o_total int; o_pid int; o_iid int;
  r_total int; r_pid int; r_iid int;
BEGIN
  SELECT count(*), count(patient_id), count(insurer_id) INTO o_total, o_pid, o_iid FROM public.orders;
  SELECT count(*), count(patient_id), count(insurer_id) INTO r_total, r_pid, r_iid FROM public.recurring_orders;
  RAISE NOTICE 'orders: % gesamt, % patient_id, % insurer_id', o_total, o_pid, o_iid;
  RAISE NOTICE 'recurring_orders: % gesamt, % patient_id, % insurer_id', r_total, r_pid, r_iid;
END $$;