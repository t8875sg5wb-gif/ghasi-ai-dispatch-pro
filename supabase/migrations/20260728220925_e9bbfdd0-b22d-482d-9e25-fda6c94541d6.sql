CREATE OR REPLACE FUNCTION public.enforce_order_verordnung_patient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient uuid;
BEGIN
  IF NEW.verordnung_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT patient_id INTO v_patient FROM public.verordnungen WHERE id = NEW.verordnung_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unbekannte Verordnung - Verknuepfung nicht moeglich.' USING ERRCODE = '23503';
  END IF;

  IF NEW.patient_id IS NULL OR v_patient IS NULL OR v_patient <> NEW.patient_id THEN
    RAISE EXCEPTION 'Die Verordnung gehoert zu einem anderen Patienten.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS c_enforce_order_verordnung_patient ON public.orders;
CREATE TRIGGER c_enforce_order_verordnung_patient
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_verordnung_patient();

ALTER TABLE public.verordnungen
  DROP CONSTRAINT IF EXISTS verordnungen_transportart_bekannt;

ALTER TABLE public.verordnungen
  ADD CONSTRAINT verordnungen_transportart_bekannt
  CHECK (transportart IN ('Liegendtransport','Sitzendtransport','Rollstuhl','Dialysefahrt'))
  NOT VALID;