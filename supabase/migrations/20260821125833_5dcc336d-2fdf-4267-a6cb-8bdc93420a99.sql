CREATE OR REPLACE FUNCTION public.apply_payroll_run_calculation(
  p_run_id uuid,
  p_items jsonb,
  p_status text,
  p_employment_id uuid,
  p_verguetungsart text,
  p_stunden numeric,
  p_stundenlohn numeric,
  p_brutto numeric,
  p_summe_abzuege numeric,
  p_netto numeric,
  p_summe_arbeitgeberkosten numeric,
  p_fehlende_punkte jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.payroll_runs WHERE id = p_run_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Lohnlauf nicht gefunden.' USING ERRCODE = '23503';
  END IF;

  IF v_status = 'freigegeben' THEN
    RAISE EXCEPTION 'Ein freigegebener Lohnlauf ist unveraenderlich und kann nicht neu berechnet werden.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.payroll_run_items WHERE run_id = p_run_id;

  INSERT INTO public.payroll_run_items (
    run_id, rule_id, regel_kennung, regel_bezeichnung, kategorie, berechnungsart,
    prozentsatz, festbetrag, basisbetrag, betrag, quelle, quelle_version
  )
  SELECT p_run_id, x.rule_id, x.regel_kennung, x.regel_bezeichnung, x.kategorie, x.berechnungsart,
         x.prozentsatz, x.festbetrag, x.basisbetrag, x.betrag, x.quelle, x.quelle_version
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS x(
    rule_id uuid, regel_kennung text, regel_bezeichnung text, kategorie text,
    berechnungsart text, prozentsatz numeric, festbetrag numeric, basisbetrag numeric,
    betrag numeric, quelle text, quelle_version text
  );

  UPDATE public.payroll_runs
  SET status = p_status,
      employment_id = p_employment_id,
      verguetungsart = p_verguetungsart,
      stunden = p_stunden,
      stundenlohn = p_stundenlohn,
      brutto = p_brutto,
      summe_abzuege = p_summe_abzuege,
      netto = p_netto,
      summe_arbeitgeberkosten = p_summe_arbeitgeberkosten,
      fehlende_punkte = COALESCE(p_fehlende_punkte, '[]'::jsonb)
  WHERE id = p_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payroll_run_calculation(uuid, jsonb, text, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_payroll_run_calculation(uuid, jsonb, text, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) TO authenticated;